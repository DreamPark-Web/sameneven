import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

interface VisionResponse {
  responses: {
    fullTextAnnotation?: {
      text: string
    }
    error?: { message: string }
  }[]
}

function extractHighestAmount(text: string): number {
  const matches = text.match(/\d{1,4}[.,]\d{2}/g)
  if (!matches) return NaN
  const amounts = matches.map(m => parseFloat(m.replace(',', '.')))
  return Math.max(...amounts)
}

export async function POST(req: NextRequest) {
  if (!process.env.GOOGLE_VISION_API_KEY) {
    return NextResponse.json({ error: 'Scanfunctie niet geconfigureerd' }, { status: 503 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('balance_entries')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id)
    .eq('via_scan', true)
    .gte('created_at', weekAgo)

  if ((count ?? 0) >= 15) {
    return NextResponse.json({ error: 'Scanlimiet bereikt (15 per week)' }, { status: 429 })
  }

  const { imageBase64 } = await req.json() as { imageBase64: string; mimeType: string }
  const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '')

  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Data },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      }),
    }
  )

  if (!visionRes.ok) {
    return NextResponse.json({ error: 'Scan mislukt, probeer opnieuw' }, { status: 500 })
  }

  const visionData = await visionRes.json() as VisionResponse
  const response = visionData.responses?.[0]

  if (response?.error) {
    return NextResponse.json({ error: 'Scan mislukt, probeer opnieuw' }, { status: 500 })
  }

  const fullText = response?.fullTextAnnotation?.text ?? ''
  const amount = extractHighestAmount(fullText)

  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Kon bedrag niet herkennen op de bon' }, { status: 422 })
  }

  return NextResponse.json({ amount })
}
