import * as fs from "jsr:@std/fs"
import * as path from "jsr:@std/path"
import { parseArgs } from "jsr:@std/cli/parse-args"
import { Body } from "./models/body.ts"
import { Event } from "https://github.com/Sonic853/EventIssue2Json/raw/master/Model/Event.ts"
import { Body as EventsBody } from "https://github.com/Sonic853/EventIssue2Json/raw/master/Model/Body.ts"
import { TranslationJ } from "https://github.com/Sonic853/EventIssue2Json/raw/master/Model/I18n.ts"
import { EventItem } from "./models/event.ts"

const now = new Date()
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

const flags = parseArgs(Deno.args, {
  string: [
    "url",
    "proxy",
  ],
})

if (!flags.url) {
  console.error("Missing required flags")
  Deno.exit(1)
}

const url = flags.url

let client: Deno.HttpClient | undefined
if (flags.proxy) {
  client = Deno.createHttpClient({
    proxy: {
      url: flags.proxy,
    },
  })
}

let res: Response
if (!client) {
  res = await fetch(url, {
    method: "GET",
  })
}
else {
  res = await fetch(url, {
    method: "GET",
    client
  })
}

const events: Event[] = []
const platforms: Record<string, number> = {}
const tags: Record<string, number> = {}
const i18nTags = await (await fetch("https://github.com/UdonEvent/udonevent.github.io/raw/refs/heads/master/i18n/tags.json")).text()
const i18nJson: TranslationJ = i18nTags ? JSON.parse(i18nTags) : {}
const addedI18n: TranslationJ = {}

const getTag = (tag: string) => {
  const keys = Object.keys(i18nJson)
  for (const key of keys) {
    if (i18nJson[key]["zh-CN"] === tag) {
      addedI18n[key] = {
        "zh-CN": tag,
      }
      return key
    }
  }
  let tagEn: string
  switch (tag) {
    case "聚会":
      {
        tagEn = "Party"
      }
      break
    case "派对":
      {
        tagEn = "Party"
      }
      break
    case "逛图":
      {
        tagEn = "Travel"
      }
      break
    case "学习":
      {
        tagEn = "Learn"
      }
      break
    case "舞蹈":
      {
        tagEn = "Dance"
      }
      break
    case "RP":
      {
        tagEn = "Roleplay"
      }
      break
    default: return tag
  }
  addedI18n[tagEn] = {
    "zh-CN": i18nJson[tagEn]["zh-CN"],
  }
  // 模糊匹配
  // for (const key of keys) {
  //   if (i18nJson[key]["zh-CN"].includes(tag)) {
  //     return key
  //   }
  // }
  return tagEn
}

const result = await res.text()
if (!result) {
  console.error("Failed to fetch events data")
  Deno.exit(1)
}

let resultData: Body
try {
  resultData = JSON.parse(result)
} catch (error) {
  console.error(`Failed to parse events data: ${error} \n${result}`)
  Deno.exit(1)
}

const addeventItem = (eventItem: EventItem) => {
  const start = eventItem.start_day && eventItem.start_time ? `${eventItem.start_day}T${eventItem.start_time}+08:00` : ""
  const end = eventItem.end_day && eventItem.end_time ? `${eventItem.end_day}T${eventItem.end_time}+08:00` : ""
  if (
    (!start && !end)
    || (end && new Date(end) < today)
    || (!end && start && new Date(start) < today)
  ) return
  const eventtags: string[] = []
  for (const tagZh of eventItem.tags) {
    const tag = getTag(tagZh)
    if (!eventtags.includes(tag)) {
      eventtags.push(tag)
      tags[tag] = (tags[tag] || 0) + 1
    }
  }
  platforms["PC"] = (platforms["PC"] || 0) + 1
  const url = eventItem.vrc_group_id || eventItem.join_link || ""
  const event: Event = {
    id: eventItem.uuid,
    author: eventItem.uploader || "",
    start,
    end,
    title: eventItem.title || "",
    description: eventItem.description || "",
    location: eventItem.location || "",
    tags: eventtags,
    instance_type: eventItem.is_public ? "Public" : "",
    platform: ["PC"],
    language: "zh-CN",
    require: "",
    join: "",
    note: "",
    group: {
      name: eventItem.vrc_group_name || (url ? "点击查看" : ""),
      id: url,
    },
  }
  events.push(event)
}

try {
  for (const eventItem of resultData.data.shortTerm) {
    addeventItem(eventItem)
  }
  for (const eventItem of resultData.data.longTerm) {
    addeventItem(eventItem)
  }
  for (const eventItem of resultData.data.unknownStartTime) {
    addeventItem(eventItem)
  }
} catch (error) {
  console.error("Error processing data:", error)
  Deno.exit(1)
}

// 根据时间排序
events.sort((a, b) => {
  const dateA = new Date(a.start)
  const dateB = new Date(b.start)
  return dateA.getTime() - dateB.getTime()
})

// 读取 info.json 文件
const infoJsonPath = path.join(".", "rlvrcv2", "info.json")
let data: EventsBody = JSON.parse("{}")
if (await fs.exists(infoJsonPath)) {
  try {
    const infoJsonText = await Deno.readTextFile(infoJsonPath)
    data = JSON.parse(infoJsonText)
  } catch (error) {
    console.error("Error reading info.json:", error)
  }
}

// 将 events 写入到 pages/events.json 文件中
data.imageCount = 0
data.description = resultData.inform
data.platform = platforms
data.tags = tags
data.events = events
data.i18n = addedI18n
const eventsData = JSON.stringify(data, null, 2)
const folder = path.join(".", "pages")
if (!await fs.exists(folder)) {
  await Deno.mkdir(folder, { recursive: true })
}
await Deno.writeTextFile(path.join(folder, "rlvrcv2.json"), eventsData)
