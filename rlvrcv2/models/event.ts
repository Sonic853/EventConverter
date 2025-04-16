export interface EventItem {
  /**
   * ID
   */
  id: number
  /**
   * UUID
   */
  uuid: string
  /**
   * 标题
   */
  title: string
  /**
   * 描述
   */
  description: string
  /**
   * 标签
   */
  tags: string[]
  /**
   * 开始日期
   */
  start_day?: string
  /**
   * 开始时间
   */
  start_time?: string
  /**
   * 结束日期
   */
  end_day?: string
  /**
   * 结束时间
   */
  end_time?: string
  /**
   * 活动地点
   */
  location?: string
  /**
   * 加入链接
   */
  join_link?: string
  /**
   * 活动类型
   */
  event_type?: string
  /**
   * 活动人数上限
   */
  max_participants: number
  /**
   * 是否公开
   */
  is_public: boolean
  /**
   * 海报ID
   */
  poster_id?: number
  /**
   * 海报链接
   */
  poster_url?: string
  /**
   * VRC 海报链接
   */
  vrc_poster_url?: string
  /**
   * 活动创办者
   */
  uploader: string
  /**
   * 群组名
   */
  vrc_group_name?: string
  /**
   * 群组ID
   */
  vrc_group_id?: string
  /**
   * 创建日期
   */
  created_at: string
  /**
   * 更新日期
   */
  updated_at: string
}