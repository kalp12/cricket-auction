import { useRef, useCallback } from 'react'

const BASE = 'http://localhost:8000'

type SoundKey = 'gavel' | 'unsold' | 'timer' | 'celebration'

const DEFAULT_SOUNDS: Record<SoundKey, string> = {
  gavel: '/sounds/gavel.mp3',
  unsold: '/sounds/unsold.mp3',
  timer: '/sounds/timer_alarm.mp3',
  celebration: '/sounds/celebration.mp3',
}

const SOUND_COLUMN_MAP: Record<SoundKey, string> = {
  gavel: 'sound_gavel',
  unsold: 'sound_unsold',
  timer: 'sound_timer',
  celebration: 'sound_celebration',
}

export function useSoundBoard(auction: any | null) {
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

  const getSoundUrl = useCallback((key: SoundKey): string | null => {
    if (!auction) return null
    const customUrl = auction[SOUND_COLUMN_MAP[key]]
    if (customUrl) {
      return customUrl.startsWith('http') ? customUrl : `${BASE}${customUrl}`
    }
    return DEFAULT_SOUNDS[key]
  }, [auction])

  const playSound = useCallback((key: SoundKey) => {
    const url = getSoundUrl(key)
    if (!url) return

    // Stop any currently playing sound of the same key
    if (audioRefs.current[key]) {
      audioRefs.current[key].pause()
      audioRefs.current[key].currentTime = 0
    }

    const audio = new Audio(url)
    audioRefs.current[key] = audio
    audio.volume = 0.8
    audio.play().catch(() => {
      // Browser may block autoplay without user interaction
    })
  }, [getSoundUrl])

  const stopAll = useCallback(() => {
    Object.values(audioRefs.current).forEach(audio => {
      audio.pause()
      audio.currentTime = 0
    })
  }, [])

  return { playSound, stopAll }
}

export type { SoundKey }
