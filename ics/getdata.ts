import * as fs from "jsr:@std/fs"
import * as path from "jsr:@std/path"
import { parseArgs } from "jsr:@std/cli/parse-args"
import { convertIcsCalendar, type IcsCalendar } from "npm:ts-ics"
import { Event } from "https://github.com/Sonic853/EventIssue2Json/raw/master/Model/Event.ts"
import { Body as EventsBody } from "https://github.com/Sonic853/EventIssue2Json/raw/master/Model/Body.ts"
import { GetRegularEventDate } from "https://github.com/Sonic853/EventIssue2Json/raw/master/Method.ts"
/**
 * 从今天开始最大的天数
 */
const maximumDate = 30

const now = new Date()
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
const maxday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + maximumDate, 0, 0, 0, 0)

const flags = parseArgs(Deno.args, {
  string: [
    "proxy",
  ],
})

let client: Deno.HttpClient | undefined
if (flags.proxy) {
  client = Deno.createHttpClient({
    proxy: {
      url: flags.proxy,
    },
  })
}

const FormatWithTimezone = (date: Date, timezone: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone, // 使用输入的时区
    hourCycle: 'h23', // 保持 24 小时制
  }
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date)

  // 拼接成 ISO8601 格式
  const [year, month, day, hour, minute, second] = [
    // const [year, month, day, hour, minute] = [
    parts.find(p => p.type === 'year')?.value,
    parts.find(p => p.type === 'month')?.value,
    parts.find(p => p.type === 'day')?.value,
    parts.find(p => p.type === 'hour')?.value,
    parts.find(p => p.type === 'minute')?.value,
    parts.find(p => p.type === 'second')?.value,
  ]

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${timezone}`
  // return `${year}-${month}-${day}T${hour}:${minute}${timezone}`
}

// +0800 => +08:00
const convertTimezone = (timezone: string): string => {
  if (timezone.length !== 5 || !timezone.startsWith("+")) return timezone
  const regex = /([+-]\d{2})(\d{2})/
  const match = timezone.match(regex)
  if (match) {
    return `${match[1]}:${match[2]}`
  }
  return timezone
}

interface ICSBody extends EventsBody {
  enable: boolean
  ics: string
}

const infosJsonPath = path.join(".", "ics", "infos.json")
let datas: Record<string, ICSBody> = JSON.parse("{}")
if (await fs.exists(infosJsonPath)) {
  try {
    const infoJsonText = await Deno.readTextFile(infosJsonPath)
    datas = JSON.parse(infoJsonText)
  } catch (error) {
    console.error("Error reading info.json:", error)
  }
}

const keys = Object.keys(datas)
for (const key of keys) {
  const info = datas[key]
  if (
    !info.enable
    ||
    !info.ics
  ) continue
  let res: Response
  if (!client) {
    res = await fetch(info.ics, {
      method: "GET",
    })
  }
  else {
    res = await fetch(info.ics, {
      method: "GET",
      client
    })
  }
  const language = info.language || ""
  const icsText = await res.text()
  const calendar: IcsCalendar = convertIcsCalendar(undefined, icsText)
  const timezone = convertTimezone(calendar?.timezones?.[0]?.props?.[0]?.offsetFrom || "+08:00")
  const icsEvents = calendar?.events || []
  const events: Event[] = []
  for (const item of icsEvents) {
    const start = new Date(item.start.date)
    const end = item.end?.date ? new Date(item.end?.date) : undefined
    const endTimeIsValid = end && !isNaN(end.getTime())
    const time = endTimeIsValid ? end.getTime() - start.getTime() : 0
    let dates: Date[] = [start]
    // 如果是定期活动
    if (item.recurrenceRule?.frequency) {
      switch (item.recurrenceRule.frequency) {
        case "WEEKLY":
          {
            dates = GetRegularEventDate(start, today, maxday, "Every Week")
          }
          break
        case "DAILY":
          {
            dates = GetRegularEventDate(start, today, maxday, "Every Day")
          }
          break
        case "MONTHLY":
          {
            dates = GetRegularEventDate(start, today, maxday, "Every Month")
          }
          break
        case "YEARLY":
          {
            dates = GetRegularEventDate(start, today, maxday, "Every Year")
          }
          break
        // 不支持的频率
        default:
          console.error("Unsupported frequency:", item.recurrenceRule.frequency)
          continue
      }
      if (dates.length === 0) {
        continue
      }
      dates.forEach((date) => {
        const thisEndTime = endTimeIsValid ? new Date(date.getTime() + time) : undefined
        const event: Event = {
          id: item.uid,
          title: item.summary,
          description: item.description || "",
          start: FormatWithTimezone(date, timezone),
          end: !thisEndTime ? "" : FormatWithTimezone(thisEndTime, timezone),
          author: item.organizer?.name || "",
          location: item.location || "",
          instance_type: "",
          platform: [],
          tags: [],
          language,
          require: "",
          join: "",
          note: ""
        }
        // 将 event.description 中的 \\n 替换为 \n
        event.description = event.description.replaceAll(/\\n/g, "\n")
        events.push(event)
      })
    }
    else {
      if (
        (!start && !end)
        || (end && end < today)
        || (!end && start && start < today)
        || (start && start > maxday)
      ) continue
      const event: Event = {
        id: item.uid,
        title: item.summary,
        description: item.description || "",
        start: FormatWithTimezone(start, timezone),
        end: end ? FormatWithTimezone(end, timezone) : "",
        author: item.organizer?.name || "",
        location: item.location || "",
        instance_type: "",
        platform: [],
        tags: [],
        language,
        require: "",
        join: "",
        note: ""
      }
      events.push(event)
    }
  }
  // 根据时间排序
  events.sort((a, b) => {
    const dateA = new Date(a.start)
    const dateB = new Date(b.start)
    return dateA.getTime() - dateB.getTime()
  })
  const data: EventsBody = {
    name: info.name,
    description: info.description,
    language,
    url: info.url,
    submitUrl: info.submitUrl,
    events,
    imageCount: 0,
    platform: {},
    tags: {},
    i18n: {}
  }
  const eventsData = JSON.stringify(data, null, 2)
  const folder = path.join(".", "pages")
  if (!await fs.exists(folder)) {
    await Deno.mkdir(folder, { recursive: true })
  }
  await Deno.writeTextFile(path.join(folder, `ics_${key}.json`), eventsData)
}