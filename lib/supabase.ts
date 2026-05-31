import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})

// Types for our tables (we'll expand these)
export type Conquest = {
  id: string
  user_id: string
  spot_name: string
  spot_address: string
  lat: number
  lng: number
  photo_url: string
  authenticity_rating: number
  distance_walked: number | null
  claimed_at: string
  badge: 'bronze' | 'silver' | 'gold'
  created_at: string
}

export type UserAchievement = {
  id: string
  user_id: string
  achievement_id: string
  unlocked_at: string
}