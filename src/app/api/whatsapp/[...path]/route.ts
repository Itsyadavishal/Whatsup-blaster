import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = 'http://localhost:3003'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const urlPath = path.join('/')
  const targetUrl = `${BACKEND_URL}/api/${urlPath}`
  
  console.log(`[WhatsApp Proxy] GET /${urlPath} -> ${targetUrl}`)
  
  try {
    // Forward the request to backend
    const headers = new Headers()
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers
    })
    
    // Get response content type
    const contentType = response.headers.get('content-type') || ''
    
    // If it's an image (QR code), forward as blob
    if (contentType.includes('image')) {
      const imageBuffer = await response.arrayBuffer()
      return new NextResponse(imageBuffer, {
        status: response.status,
        headers: { 
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        }
      })
    }
    
    // Otherwise return JSON
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
    
  } catch (error) {
    console.error('[WhatsApp Proxy] GET error:', error)
    
    // If backend is not available, return appropriate error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'WhatsApp service is not running', 
          status: 'service_unavailable',
          message: 'Please ensure the WhatsApp service is started on port 3003'
        }, 
        { status: 503 }
      )
    }
    
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const urlPath = path.join('/')
  const targetUrl = `${BACKEND_URL}/api/${urlPath}`
  
  console.log(`[WhatsApp Proxy] POST /${urlPath} -> ${targetUrl}`)
  
  try {
    // Get request body
    const body = await request.text()
    const contentType = request.headers.get('content-type') || 'application/json'
    
    // Forward the request to backend
    const headers = new Headers({
      'Content-Type': contentType
    })
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: body || undefined
    })
    
    // Return JSON response
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
    
  } catch (error) {
    console.error('[WhatsApp Proxy] POST error:', error)
    
    // If backend is not available, return appropriate error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'WhatsApp service is not running', 
          status: 'service_unavailable',
          message: 'Please ensure the WhatsApp service is started on port 3003'
        }, 
        { status: 503 }
      )
    }
    
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
