export type SourceCategory =
  | 'Immigration News'
  | 'Legal Marketing'
  | 'General Marketing'
  | 'Paid Media'
  | 'Industry Research'

export type FeedType = 'rss' | 'html' | 'reddit'

export interface SourceConfig {
  name: string
  url: string
  feedType: FeedType
  category: SourceCategory
  maxArticles: number
}

export interface RawArticle {
  headline: string
  sourceUrl: string
  sourceName: string
  sourceCategory: SourceCategory
  publishedAt: string | null
  rawContent: string
}

export interface ProcessedInsight {
  headline: string
  source_url: string
  source_origin: string
  source_category: string
  published_at: string | null
  raw_content: string
  summary: string
  impact_analysis: string
  action_strategy: string
  training_note: string
  pitch_angle: string
  social_post_angles: string[]
  dm_opener: string
  processed_by: string
  content_hash: string
  run_date: string
}

export interface AnalysisOutput {
  relevance_score: number
  summary: string
  impact_analysis: string
  action_strategy: string
  training_note: string
  pitch_angle: string
  social_post_angles: string[]
  dm_opener: string
}
