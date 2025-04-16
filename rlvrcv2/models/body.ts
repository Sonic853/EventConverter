import { EventItem } from "./event.ts"

export interface Data {
  /**
   * 未知时间/待定
   */
  unknownStartTime: EventItem[]
  /**
   * 短期活动
   */
  shortTerm: EventItem[]
  /**
   * 长期活动
   */
  longTerm: EventItem[]
}
export interface Body {
  /**
   * 内容
   */
  data: Data
  /**
   * 描述
   */
  inform: string
}