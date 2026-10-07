import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import { chromium, Page, BrowserContext } from 'playwright'
import fs from 'fs'
import path from 'path'
import os from 'os'

const app = express()
const PORT = 3003

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// ==================== STATE MANAGEMENT ====================
const SESSION_PATH = path.join(process.cwd(), '.whatsapp-session')
let browserContext: BrowserContext | null = null
let page: Page | null = null
let isAuthenticated = false
let qrCodeData: string | null = null
let isInitializing = false
let currentJobId: string | null = null
let authMethod: 'qr' | 'phone' | null = null
let phoneNumberLinking: { active: boolean; code?: string; linkSent?: boolean } = { active: false }
let lastCapturedRef: string | null = null
let lastCaptureTime = 0
let isCapturingQR = false

// Message storage
interface MessageStatus {
  id: string
  phoneNumber: string
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'not_registered' | 'rate_limited'
  message?: string
  error?: string
  timestamp: Date
}
const messageStatuses = new Map<string, MessageStatus>()

// Logging
function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

function errorLog(msg: string) {
  console.error(`[${new Date().toISOString()}] ERROR: ${msg}`)
}

// ==================== BROWSER MANAGEMENT ====================
async function closeBrowser() {
  if (browserContext) {
    await browserContext.close().catch(() => {})
    browserContext = null
    page = null
    log('Browser closed')
  }
}

async function clearSessionData() {
  log('Clearing WhatsApp session data from disk...')
  await closeBrowser()
  try {
    if (fs.existsSync(SESSION_PATH)) {
      // Small pause to allow file handles to be released
      await new Promise(r => setTimeout(r, 600))
      fs.rmSync(SESSION_PATH, { recursive: true, force: true })
      log('WhatsApp session data directory removed successfully')
    }
  } catch (err) {
    errorLog(`Failed to delete session directory: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function getBrowserContext(): Promise<BrowserContext> {
  if (browserContext) {
    try {
      browserContext.pages()
      return browserContext
    } catch {
      browserContext = null
      page = null
    }
  }
  
  if (!fs.existsSync(SESSION_PATH)) {
    fs.mkdirSync(SESSION_PATH, { recursive: true })
  }
  
  log(`Launching persistent browser context from: ${SESSION_PATH}`)
  browserContext = await chromium.launchPersistentContext(SESSION_PATH, {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--no-first-run',
      '--no-default-browser-check'
    ],
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  })

  // Apply stealth scripts on context level so all pages and frames are masked
  await browserContext.addInitScript(() => {
    // 1. Hide navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // 2. Mock chrome object
    (window as any).chrome = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
      },
      runtime: {
        OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
        RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }
      }
    };

    // 3. Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
      ],
    });

    // 4. Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  log('Persistent browser context launched successfully with stealth protections')
  return browserContext
}

// ==================== WHATSAPP WEB INTEGRATION ====================

// QR Code selectors - multiple strategies for robustness
const QR_SELECTORS = [
  'canvas[aria-label*="Scan this"]',
  'canvas[aria-label*="QR"]',
  'div[data-ref]',
  'img[alt*="QR"]',
  '#app > div > div > div',
  'canvas'
]

// Phone linking selectors
const PHONE_LINK_SELECTORS = [
  'a[href*="linkdevice"]',
  'button:has-text("Link with phone number")',
  'button:has-text("Phone number")',
  '[data-testid="phone-number-link"]'
]

async function waitForQRCode(page: Page, timeout: number = 60000): Promise<string | null> {
  const startTime = Date.now()
  
  // First, wait for QR code to be ready (scan text to appear)
  log('Waiting for QR code to appear on page...')
  try {
    await page.waitForSelector('text=Scan this', { timeout: 15000 }).catch(() => {
      log('Scan this text not found, continuing anyway...')
    })
    // Also wait a bit for the QR to fully render
    await new Promise(resolve => setTimeout(resolve, 2000))
  } catch (e) {
    log('Timeout waiting for scan text')
  }
  
  while (Date.now() - startTime < timeout) {
    try {
      // Strategy 1: Look for canvas element and verify it has QR content
      const canvasElement = await page.$('canvas')
      if (canvasElement) {
        const box = await canvasElement.boundingBox()
        if (box && box.width > 150 && box.height > 150) {
          log(`Found canvas: ${box.width}x${box.height}`)
          
          // Screenshot the canvas as PNG
          const screenshotBuffer = await canvasElement.screenshot({ type: 'png' })
          const base64Data = screenshotBuffer.toString('base64')
          
          // Validate it's a real QR code (should be larger than a simple logo)
          // Real QR codes are typically 5KB+ for 228x228
          if (base64Data.length > 5000) {
            log(`Captured valid QR code (${screenshotBuffer.length} bytes)`)
            lastCaptureTime = Date.now()
            lastCapturedRef = await page.evaluate(() => document.querySelector('[data-ref]')?.getAttribute('data-ref') || null).catch(() => null)
            return `data:image/png;base64,${base64Data}`
          } else {
            log(`Canvas too small (${base64Data.length} chars), likely loading screen...`)
          }
        }
      }
      
      // Strategy 2: Look for specific QR code container with proper content
      const qrContainer = await page.$('[data-ref="qrcode"], div[title*="QR"], #app > div > div > div > div')
      if (qrContainer) {
        const screenshotBuffer = await qrContainer.screenshot({ type: 'png' })
        if (screenshotBuffer.length > 5000) {
          const base64Data = screenshotBuffer.toString('base64')
          log('Captured QR from data-ref container')
          lastCaptureTime = Date.now()
          lastCapturedRef = await page.evaluate(() => document.querySelector('[data-ref]')?.getAttribute('data-ref') || null).catch(() => null)
          return `data:image/png;base64,${base64Data}`
        }
      }
      
      // Strategy 3: Take screenshot of the main area where QR appears
      // The QR is usually in the center of the screen
      const mainContent = await page.$('#app > div > div:nth-child(2)')
      if (mainContent) {
        const screenshotBuffer = await mainContent.screenshot({ type: 'png' })
        if (screenshotBuffer.length > 8000) {  // Real QR should be substantial
          const base64Data = screenshotBuffer.toString('base64')
          log('Captured QR from main content area')
          lastCaptureTime = Date.now()
          lastCapturedRef = await page.evaluate(() => document.querySelector('[data-ref]')?.getAttribute('data-ref') || null).catch(() => null)
          return `data:image/png;base64,${base64Data}`
        }
      }
      
      // Strategy 4: Full page screenshot as last resort
      const bodyScreenshot = await page.screenshot({ type: 'png', fullPage: false })
      if (bodyScreenshot.length > 15000) {
        log('Using full page screenshot for QR capture')
        lastCaptureTime = Date.now()
        lastCapturedRef = await page.evaluate(() => document.querySelector('[data-ref]')?.getAttribute('data-ref') || null).catch(() => null)
        return `data:image/png;base64,${bodyScreenshot.toString('base64')}`
      }
      
    } catch (error) {
      errorLog(`Error capturing QR: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  return null
}

async function getOrUpdateLiveQRCode(p: Page): Promise<string | null> {
  if (isCapturingQR || isAuthenticated) return qrCodeData
  isCapturingQR = true
  
  try {
    // 1. Check if WhatsApp Web has dimmed the QR and displayed the reload overlay
    const reloadSelectors = [
      'button:has-text("Reload")',
      'button:has-text("Click to reload")',
      '[data-testid="reload-qr-button"]',
      'span[data-icon="refresh"]',
      'div[role="button"]:has(span[data-icon="refresh"])',
      'div[role="button"]:has-text("Reload")'
    ]
    
    let clickedReload = false
    for (const selector of reloadSelectors) {
      try {
        const reloadBtn = await p.$(selector)
        if (reloadBtn) {
          const isVisible = await reloadBtn.isVisible().catch(() => false)
          if (isVisible) {
            log('[Live QR] WhatsApp Web displayed reload button. Auto-clicking to refresh challenge token...')
            await reloadBtn.click().catch(() => {})
            clickedReload = true
            // Give WhatsApp Web 1.5 seconds to query a new challenge token and redraw canvas
            await new Promise(resolve => setTimeout(resolve, 1500))
            break
          }
        }
      } catch {}
    }

    // 2. Extract current data-ref if present in DOM
    const currentRef = await p.evaluate(() => {
      const el = document.querySelector('[data-ref]')
      return el ? el.getAttribute('data-ref') : null
    }).catch(() => null)

    const now = Date.now()
    const refChanged = !!(currentRef && currentRef !== lastCapturedRef)
    const timeSinceLastCapture = now - lastCaptureTime
    const needsCapture = clickedReload || !qrCodeData || refChanged || timeSinceLastCapture > 8000

    if (needsCapture) {
      // Find the QR canvas or container
      const canvas = await p.$('canvas')
      if (canvas) {
        const box = await canvas.boundingBox().catch(() => null)
        if (box && box.width > 120 && box.height > 120) {
          const buffer = await canvas.screenshot({ type: 'png' }).catch(() => null)
          if (buffer && buffer.length > 3000) {
            const base64 = buffer.toString('base64')
            qrCodeData = `data:image/png;base64,${base64}`
            lastCapturedRef = currentRef
            lastCaptureTime = now
            if (refChanged) {
              log(`[Live QR] Token challenge rotated by WhatsApp! Captured fresh QR code (${buffer.length} bytes).`)
            }
            return qrCodeData
          }
        }
      }

      // Fallback: look for data-ref container or QR container
      const qrContainer = await p.$('div[data-ref], [data-ref="qrcode"], div[title*="QR"]').catch(() => null)
      if (qrContainer) {
        const buffer = await qrContainer.screenshot({ type: 'png' }).catch(() => null)
        if (buffer && buffer.length > 3000) {
          const base64 = buffer.toString('base64')
          qrCodeData = `data:image/png;base64,${base64}`
          lastCapturedRef = currentRef
          lastCaptureTime = now
          return qrCodeData
        }
      }
    }
  } catch (err) {
    // Non-fatal error during live polling
  } finally {
    isCapturingQR = false
  }
  
  return qrCodeData
}

async function checkAuthenticationStatus(page: Page): Promise<boolean> {
  try {
    // Check if we're on the main chat interface (authenticated)
    const mainChat = await page.$('[data-testid="chat-list"], [data-testid="conversation-panel"], header')
    if (mainChat) {
      // Additional check - make sure we're not still on loading/auth screen
      const url = page.url()
      if (!url.includes('auth') && !url.includes('login')) {
        return true
      }
    }
    
    // Also check for specific authenticated elements
    const isAuthenticatedState = await page.evaluate(() => {
      // Check for elements that only exist when authenticated
      const chatList = document.querySelector('[data-testid="chat-list"]')
      const conversationPanel = document.querySelector('[data-testid="conversation-panel"]')
      const mainHeader = document.querySelector('header[data-testid="list-header"]')
      return !!(chatList || conversationPanel || mainHeader)
    })
    
    return isAuthenticatedState
  } catch (error) {
    errorLog(`Error checking auth status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return false
  }
}

async function initiateWhatsAppWeb(): Promise<{ success: boolean; error?: string; alreadyAuthenticated?: boolean }> {
  try {
    const ctx = await getBrowserContext()
    const pages = ctx.pages()
    page = pages.length > 0 ? pages[0] : await ctx.newPage()
    
    log('Navigating to WhatsApp Web...')
    await page.goto('https://web.whatsapp.com', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })
    
    // Wait for page to load
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {
      log('Page load event timeout, continuing...')
    })

    // Check if session was restored from persistent context
    await new Promise(resolve => setTimeout(resolve, 2500))
    const isAuthed = await checkAuthenticationStatus(page)
    if (isAuthed) {
      log('WhatsApp Web restored authenticated session from disk!')
      isAuthenticated = true
      return { success: true, alreadyAuthenticated: true }
    }
    
    log('WhatsApp Web loaded successfully')
    return { success: true }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to initialize WhatsApp Web'
    errorLog(errorMsg)
    return { success: false, error: errorMsg }
  }
}

async function clickPhoneLinkOption(): Promise<boolean> {
  if (!page) return false
  
  try {
    // Look for "Link with phone number" button or link
    const linkSelectors = [
      'text=Link with phone number',
      'text=Phone number',
      'a:has-text("phone")',
      'button:has-text("Link")',
      '[data-testid="phone-link"]'
    ]
    
    for (const selector of linkSelectors) {
      try {
        const element = await page.$(selector)
        if (element) {
          await element.click({ timeout: 5000 })
          log('Clicked phone number link option')
          return true
        }
      } catch (e) {
        continue
      }
    }
    
    // Alternative: Look for any link that mentions phone/device linking
    const found = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, [role="button"]'))
      const phoneLink = links.find(el => 
        el.textContent?.toLowerCase().includes('phone') ||
        el.textContent?.toLowerCase().includes('link device')
      )
      if (phoneLink) {
        (phoneLink as HTMLElement).click()
        return true
      }
      return false
    })
    
    return found
    
  } catch (error) {
    errorLog(`Error clicking phone link: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return false
  }
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    authenticated: isAuthenticated,
    hasBrowser: browserContext !== null,
    mode: 'live',
    timestamp: new Date().toISOString()
  })
})

// Initialize / Get QR code
app.post('/api/init', async (req, res) => {
  if (isAuthenticated) {
    return res.json({
      status: 'authenticated',
      message: 'Already connected to WhatsApp'
    })
  }
  
  if (isInitializing) {
    return res.json({ 
      status: 'initializing', 
      message: 'Please wait... Initializing connection to WhatsApp Web' 
    })
  }
  
  isInitializing = true
  authMethod = 'qr'
  log('Initializing WhatsApp Web connection...')
  
  try {
    // Initialize WhatsApp Web
    const initResult = await initiateWhatsAppWeb()
    if (!initResult.success) {
      isInitializing = false
      return res.status(500).json({
        status: 'error',
        error: initResult.error,
        message: 'Failed to connect to WhatsApp Web'
      })
    }

    if (initResult.alreadyAuthenticated || isAuthenticated) {
      isInitializing = false
      isAuthenticated = true
      qrCodeData = null
      return res.json({
        status: 'authenticated',
        message: 'Already connected to WhatsApp'
      })
    }
    
    // Wait a moment for QR code to appear
    log('Waiting for QR code to appear...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Try to capture QR code
    qrCodeData = await waitForQRCode(page!, 45000)
    
    if (qrCodeData) {
      isInitializing = false
      log('QR code captured successfully')
      res.json({
        status: 'qr_code_required',
        message: 'Scan this QR code with your WhatsApp phone app',
        qrCode: qrCodeData,
        instructions: [
          'Open WhatsApp on your phone',
          'Tap Menu or Settings and select Linked Devices',
          'Point your phone at this screen to capture the QR code'
        ],
        alternativeAvailable: true,
        mode: 'live'
      })
    } else {
      // QR capture failed but page might be loaded
      isInitializing = false
      log('QR code capture timed out, returning page state')
      
      // Take a screenshot of current state for debugging
      let debugScreenshot = null
      if (page) {
        try {
          const debugBuffer = await page.screenshot({ type: 'png' })
          debugScreenshot = `data:image/png;base64,${debugBuffer.toString('base64')}`
        } catch (e) {
          // Ignore screenshot errors
        }
      }
      
      res.json({
        status: 'qr_pending',
        message: 'QR code is loading. Please try again or use phone number linking.',
        qrCode: debugScreenshot,
        alternativeAvailable: true,
        mode: 'live'
      })
    }
    
  } catch (error) {
    isInitializing = false
    const errorMsg = error instanceof Error ? error.message : 'Initialization failed'
    errorLog(errorMsg)
    res.status(500).json({
      status: 'error',
      error: errorMsg,
      message: 'Failed to initialize WhatsApp connection'
    })
  }
})

// Initialize with phone number linking
app.post('/api/init-phone', async (req, res) => {
  if (isAuthenticated) {
    return res.json({
      status: 'authenticated',
      message: 'Already connected to WhatsApp'
    })
  }
  
  if (isInitializing) {
    return res.json({ 
      status: 'initializing', 
      message: 'Please wait...' 
    })
  }
  
  const { phoneNumber } = req.body
  
  if (!phoneNumber) {
    return res.status(400).json({
      status: 'error',
      error: 'Phone number required',
      message: 'Please provide your phone number in international format (e.g., +1234567890)'
    })
  }
  
  isInitializing = true
  authMethod = 'phone'
  phoneNumberLinking = { active: true }
  log(`Initializing with phone number: ${phoneNumber}`)
  
  try {
    // Initialize WhatsApp Web first
    const initResult = await initiateWhatsAppWeb()
    if (!initResult.success) {
      isInitializing = false
      phoneNumberLinking = { active: false }
      return res.status(500).json({
        status: 'error',
        error: initResult.error
      })
    }
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Click on "Link with phone number" option
    const clicked = await clickPhoneLinkOption()
    
    if (clicked) {
      // Wait for the phone input form
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Try to enter the phone number
      if (page) {
        // Look for phone input field
        const phoneInputSelectors = [
          'input[type="tel"]',
          'input[placeholder*="phone"]',
          'input[placeholder*="number"]',
          'input[id*="phone"]'
        ]
        
        for (const selector of phoneInputSelectors) {
          try {
            const input = await page.$(selector)
            if (input) {
              await input.fill(phoneNumber)
              log(`Entered phone number: ${phoneNumber}`)
              
              // Look for send/link button
              await new Promise(resolve => setTimeout(resolve, 500))
              const submitButton = await page.$('button[type="submit"], button:has-text("Send"), button:has-text("Next")')
              if (submitButton) {
                await submitButton.click()
                phoneNumberLinking.linkSent = true
                log('Submitted phone number for linking')
              }
              break
            }
          } catch (e) {
            continue
          }
        }
      }
    }
    
    isInitializing = false
    
    // Take screenshot of current state
    let currentState = null
    if (page) {
      try {
        const screenshotBuffer = await page.screenshot({ type: 'png' })
        currentState = `data:image/png;base64,${screenshotBuffer.toString('base64')}`
      } catch (e) {
        // Ignore
      }
    }
    
    res.json({
      status: 'phone_linking',
      message: 'Phone number linking initiated',
      phoneNumber,
      screenshot: currentState,
      instructions: [
        'Check your phone for a SMS or notification from WhatsApp',
        'Enter the code you receive to complete linking',
        'The code expires after a few minutes'
      ],
      mode: 'live'
    })
    
  } catch (error) {
    isInitializing = false
    phoneNumberLinking = { active: false }
    const errorMsg = error instanceof Error ? error.message : 'Phone linking failed'
    errorLog(errorMsg)
    res.status(500).json({
      status: 'error',
      error: errorMsg
    })
  }
})

// Get QR code image (direct image response)
app.get('/api/qrcode', async (req, res) => {
  if (isAuthenticated) {
    return res.status(400).json({ status: 'already_authenticated' })
  }
  
  // If we have cached QR data, return it
  if (qrCodeData) {
    const matches = qrCodeData.match(/^data:(.+);base64,(.+)$/)
    if (matches) {
      res.set('Content-Type', matches[1])
      res.send(Buffer.from(matches[2], 'base64'))
      return
    }
  }
  
  // If browser is open, try to capture fresh QR
  if (page) {
    const freshQR = await waitForQRCode(page, 15000)
    if (freshQR) {
      qrCodeData = freshQR
      const matches = freshQR.match(/^data:(.+);base64,(.+)$/)
      if (matches) {
        res.set('Content-Type', matches[1])
        res.send(Buffer.from(matches[2], 'base64'))
        return
      }
    }
  }
  
  res.status(404).json({ status: 'no_qr_code_available' })
})

// Refresh QR code (get new one)
app.post('/api/refresh-qr', async (req, res) => {
  if (isAuthenticated) {
    return res.json({ status: 'authenticated' })
  }
  
  log('Refreshing QR code...')
  
  // Clear existing QR
  qrCodeData = null
  lastCapturedRef = null
  lastCaptureTime = 0
  
  if (page) {
    // Priority 1: Check if reload button is already on screen and click it
    const reloadBtn = await page.$('button:has-text("Reload"), [data-testid="reload-qr-button"], span[data-icon="refresh"], div[role="button"]:has(span[data-icon="refresh"])').catch(() => null)
    if (reloadBtn) {
      log('Found WhatsApp reload button. Clicking to regenerate QR...')
      await reloadBtn.click().catch(() => {})
      await new Promise(resolve => setTimeout(resolve, 1500))
      const newQR = await waitForQRCode(page, 15000)
      if (newQR) {
        qrCodeData = newQR
        return res.json({
          status: 'qr_code_refreshed',
          qrCode: newQR
        })
      }
    }

    // Priority 2: Try to reload the page to get new QR
    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Capture new QR
      const newQR = await waitForQRCode(page, 30000)
      if (newQR) {
        qrCodeData = newQR
        log('QR code refreshed successfully')
        return res.json({
          status: 'qr_code_refreshed',
          qrCode: newQR
        })
      }
    } catch (error) {
      errorLog(`Error refreshing QR: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }
  
  // If refresh failed, try full re-init
  isInitializing = false // Allow re-init
  res.json({
    status: 'refresh_failed',
    message: 'Could not refresh QR. Please click "Connect WhatsApp" to try again.'
  })
})

// Status
app.get('/api/status', async (req, res) => {
  // Check actual authentication status if we have a page
  if (page && !isAuthenticated) {
    const authStatus = await checkAuthenticationStatus(page)
    if (authStatus) {
      isAuthenticated = true
      qrCodeData = null
      lastCapturedRef = null
      log('Detected successful authentication!')
    }
  }
  
  res.json({
    authenticated: isAuthenticated,
    initializing: isInitializing,
    hasQRCode: qrCodeData !== null,
    authMethod,
    phoneLinking: phoneNumberLinking,
    hasBrowser: browserContext !== null,
    mode: 'live'
  })
})

// Auth poll (for frontend to check scanning status and stream latest live QR code)
app.get('/api/auth-poll', async (req, res) => {
  if (isAuthenticated) {
    return res.json({ 
      authenticated: true, 
      mode: 'live',
      authMethod 
    })
  }
  
  // Check actual browser state
  if (page) {
    const authStatus = await checkAuthenticationStatus(page)
    if (authStatus) {
      isAuthenticated = true
      qrCodeData = null
      lastCapturedRef = null
      log('User authenticated via QR scan!')
      return res.json({ 
        authenticated: true, 
        mode: 'live',
        authMethod: 'qr'
      })
    }
    
    // Automatically keep QR code fresh and handle Meta's reload overlay
    if (!isInitializing) {
      await getOrUpdateLiveQRCode(page)
    }
  }
  
  res.json({ 
    authenticated: false, 
    mode: 'live',
    qrCode: qrCodeData,
    hasQRCode: qrCodeData !== null,
    qrExpired: false
  })
})

// Send single message
app.post('/api/send-message', async (req, res) => {
  const { phoneNumber, message, messageId, file, files, media } = req.body
  const filesToSend = media || files || (file ? [file] : [])
  
  if (!phoneNumber || (!message && filesToSend.length === 0)) {
    return res.status(400).json({ error: 'Phone number and message or file required' })
  }
  
  if (!isAuthenticated || !page) {
    return res.status(401).json({ error: 'Not connected to WhatsApp. Please authenticate first.' })
  }
  
  const id = messageId || uuidv4()
  const status: MessageStatus = {
    id,
    phoneNumber,
    status: 'sending',
    message: message || '',
    timestamp: new Date()
  }
  messageStatuses.set(id, status)
  
  // Send message and media using Playwright, awaiting real outcome
  await sendMessageToWhatsApp(phoneNumber, message || '', filesToSend, id)
  
  const currentStatus = messageStatuses.get(id) || status
  res.json({
    success: currentStatus.status === 'sent',
    status: currentStatus.status,
    error: currentStatus.error,
    id
  })
})

async function sendMessageToWhatsApp(phoneNumber: string, message: string, filesToSend: any[] = [], messageId: string) {
  const status = messageStatuses.get(messageId)
  if (!status || !page) return
  
  const tempFiles: string[] = []
  
  try {
    // 1. Process attachments into temporary local files if present
    if (filesToSend && filesToSend.length > 0) {
      const tempDir = path.join(os.tmpdir(), 'whatsapp-blaster')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      
      for (let idx = 0; idx < filesToSend.length; idx++) {
        const item = filesToSend[idx]
        const rawData = item.data || item.dataUrl || item.base64
        if (!rawData) continue
        
        const matches = typeof rawData === 'string' ? rawData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/) : null
        const base64Content = matches ? matches[2] : (typeof rawData === 'string' ? rawData : '')
        if (!base64Content) continue
        
        const buffer = Buffer.from(base64Content, 'base64')
        const safeName = (item.name || `attachment_${idx}_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_')
        const tempPath = path.join(tempDir, `${Date.now()}_${idx}_${safeName}`)
        fs.writeFileSync(tempPath, buffer)
        tempFiles.push(tempPath)
      }
    }

    // 2. Format phone number (remove spaces, dashes, parentheses, plus)
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)\+]/g, '')
    const hasMedia = tempFiles.length > 0
    
    // 3. Open chat with the number
    // NOTE: If sending media, do NOT append &text= into the URL because WhatsApp would put it in the background composer.
    // The caption belongs inside the media preview modal instead!
    const chatUrl = `https://web.whatsapp.com/send?phone=${cleanNumber}${!hasMedia && message ? `&text=${encodeURIComponent(message)}` : ''}`
    
    log(`Navigating to chat for ${cleanNumber}...`)
    await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {})
    
    // 4. Fast polling check: Wait for chat composer OR catch invalid/unregistered number modal
    log('Waiting for chat to load (checking composer & invalid number dialog)...')
    let isReady = false
    let isNotRegistered = false
    const checkStartTime = Date.now()
    const maxWaitTime = 15000

    while (Date.now() - checkStartTime < maxWaitTime) {
      // Check if invalid/unregistered number popup appeared
      const invalidFound = await page.evaluate(() => {
        const modals = Array.from(document.querySelectorAll('div[role="dialog"], div[role="alert"], [data-animate-modal-popup="true"]'))
        for (const m of modals) {
          const t = (m.textContent || '').toLowerCase()
          if (
            t.includes('invalid') || 
            t.includes('not on whatsapp') || 
            t.includes('isn\'t on whatsapp') || 
            t.includes('couldn\'t find') || 
            t.includes('not registered')
          ) {
            return { found: true, text: m.textContent }
          }
        }
        return { found: false, text: '' }
      }).catch(() => ({ found: false, text: '' }))

      if (invalidFound.found) {
        log(`Unregistered or invalid number detected for ${cleanNumber}: "${invalidFound.text}"`)
        isNotRegistered = true
        
        // Click OK on modal to dismiss it so subsequent messages are not blocked
        const okBtn = await page.$(
          'div[role="dialog"] button, div[role="dialog"] [role="button"], button:has-text("OK"), [data-testid="popup-controls-ok"]'
        ).catch(() => null)
        if (okBtn) {
          await okBtn.click().catch(() => {})
          log('Dismissed invalid number dialog')
        }
        await new Promise(r => setTimeout(r, 600))
        break
      }

      // Check if composer or conversation panel is ready
      const composer = await page.$(
        'footer div[contenteditable="true"], div[contenteditable="true"][data-tab="10"], [data-testid="conversation-panel-wrapper"]'
      ).catch(() => null)

      if (composer) {
        isReady = true
        break
      }

      await new Promise(r => setTimeout(r, 350))
    }

    if (isNotRegistered) {
      status.status = 'not_registered'
      status.error = 'Phone number is not registered on WhatsApp'
      messageStatuses.set(messageId, status)
      return
    }

    if (!isReady) {
      // Final safety check for popup
      const popupBtn = await page.$('button:has-text("OK"), div[role="dialog"]').catch(() => null)
      if (popupBtn) {
        await popupBtn.click().catch(() => {})
        status.status = 'not_registered'
        status.error = 'Phone number is not registered on WhatsApp'
        messageStatuses.set(messageId, status)
        return
      }
      throw new Error(`Chat composer did not load in time for ${cleanNumber}`)
    }
    
    // Allow DOM to settle
    await new Promise(resolve => setTimeout(resolve, 800))

    if (hasMedia) {
      log(`Attaching ${tempFiles.length} file(s) for ${cleanNumber}...`)
      const firstFile = filesToSend[0] || {}
      const sendAs: 'photo' | 'document' | 'sticker' | 'video' | 'audio' = firstFile.sendAs || 
        (firstFile.type?.startsWith('video/') ? 'video' :
         firstFile.type?.startsWith('audio/') ? 'audio' :
         firstFile.type?.startsWith('image/') ? 'photo' : 'document')
      
      log(`Target media attachment mode: "${sendAs}"`)
      
      // Step 1: Open attach menu if not already open
      log('Looking for Attach (+) button in chat footer...')
      let attachButton = await page.$(
        'footer button[title*="Attach"], footer div[title*="Attach"], footer button[aria-label*="Attach"], footer div[aria-label*="Attach"], footer span[data-icon="plus"], footer span[data-icon="plus-alt"], footer span[data-icon="attach-menu-plus"], footer span[data-icon="clip"], footer [data-testid="attach-menu-plus"], footer [data-testid="clip"]'
      ).catch(() => null)
      
      if (!attachButton) {
        attachButton = await page.evaluateHandle(() => {
          const footer = document.querySelector('footer')
          if (!footer) return null
          const buttons = Array.from(footer.querySelectorAll('button, div[role="button"]'))
          for (const btn of buttons) {
            const title = (btn.getAttribute('title') || '').toLowerCase()
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase()
            const hasPlus = btn.querySelector('[data-icon*="plus"], [data-icon*="clip"]')
            if (title.includes('attach') || aria.includes('attach') || hasPlus) {
              return btn
            }
          }
          return buttons.length >= 2 ? buttons[1] : (buttons[0] || null)
        }).then(handle => handle.asElement()).catch(() => null)
      }
      
      if (!attachButton) {
        throw new Error('Could not find Attach button in chat footer')
      }
      
      log('Clicking attach button to open menu...')
      await attachButton.click().catch(() => {})
      await new Promise(r => setTimeout(r, 1000))
      
      let fileSetDone = false
      
      // Step 2: Route file to the exact menu option based on sendAs
      if (sendAs === 'sticker') {
        log('Attaching as STICKER...')

        // Priority 1: Find the "New sticker" menu button strictly outside footer
        let stickerBtn = await page.$(
          'button[aria-label="New sticker"], [role="menuitem"][aria-label="New sticker"], [role="menuitem"]:has-text("New sticker"), button:has-text("New sticker")'
        ).catch(() => null)

        if (!stickerBtn) {
          stickerBtn = await page.evaluateHandle(() => {
            const items = Array.from(document.querySelectorAll('[role="menuitem"], ul li button, div[role="button"], button'))
              .filter(el => !el.closest('footer'))
            return items.find(el => {
              const a = (el.getAttribute('aria-label') || '').toLowerCase().trim()
              const t = (el.textContent || '').toLowerCase().trim()
              return a === 'new sticker' || t === 'new sticker' || a.includes('sticker') || t.includes('sticker')
            }) || null
          }).then(h => h.asElement()).catch(() => null)
        }

        if (stickerBtn) {
          log('Found Sticker menu button! Triggering filechooser...')
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null),
            stickerBtn.click({ force: true }).catch(() => {})
          ])

          if (fileChooser) {
            log('Native fileChooser captured for Sticker! Setting files...')
            await fileChooser.setFiles(tempFiles)
            fileSetDone = true
          } else {
            // Check for inner or sibling file input
            const innerInput = await stickerBtn.$('input[type="file"]').catch(() => null)
            if (innerInput) {
              log('Setting files on inner file input for Sticker...')
              await innerInput.setInputFiles(tempFiles)
              fileSetDone = true
            }
          }
        }

        // Priority 2: Fallback to any non-document, non-video file input outside footer
        if (!fileSetDone) {
          log('Trying fallback file input for Sticker...')
          const fallbackInput = await page.evaluateHandle(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[]
            return inputs.find(inp => {
              if (inp.closest('footer')) return false
              const acc = (inp.accept || '').toLowerCase()
              return !acc.includes('video') && acc !== '*'
            }) || null
          }).then(h => h.asElement()).catch(() => null)

          if (fallbackInput) {
            log('Setting files on fallback sticker input...')
            await fallbackInput.setInputFiles(tempFiles)
            fileSetDone = true
          }
        }
      } else if (sendAs === 'document' || sendAs === 'audio') {
        log(`Attaching as DOCUMENT (${sendAs})...`)
        const docItem = await page.evaluateHandle(() => {
          const els = Array.from(document.querySelectorAll('button, div[role="button"], div[role="menuitem"], li, span'))
          return els.find(el => {
            const t = (el.textContent || '').trim().toLowerCase()
            const a = (el.getAttribute('aria-label') || '').toLowerCase()
            return t === 'document' || a.includes('document')
          }) || null
        }).then(h => h.asElement()).catch(() => null)

        if (docItem) {
          const innerInput = await docItem.$('input[type="file"]').catch(() => null)
          if (innerInput) {
            await innerInput.setInputFiles(tempFiles)
            fileSetDone = true
          } else {
            const [fileChooser] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null),
              docItem.click().catch(() => {})
            ])
            if (fileChooser) {
              await fileChooser.setFiles(tempFiles)
              fileSetDone = true
            }
          }
        }

        if (!fileSetDone) {
          const docInput = await page.$('input[type="file"][accept="*"], input[type="file"]:not([accept*="image"]):not([accept*="video"])').catch(() => null)
          if (docInput) {
            await docInput.setInputFiles(tempFiles)
            fileSetDone = true
          }
        }
      } else {
        // PHOTO OR VIDEO (Standard WhatsApp media attachment, NOT sticker)
        log(`Attaching as PHOTO/VIDEO (standard media, NOT sticker)...`)
        
        // Priority 1: Match the "Photos & videos" menu item and click / use filechooser
        const photoMenuItem = await page.evaluateHandle(() => {
          const els = Array.from(document.querySelectorAll('button, div[role="button"], div[role="menuitem"], li, span, div'))
          return els.find(el => {
            const t = (el.textContent || '').trim().toLowerCase()
            const a = (el.getAttribute('aria-label') || '').toLowerCase()
            const isPhotoOrVideo = (
              t === 'photos & videos' || 
              t === 'photos and videos' || 
              t === 'photos' ||
              a.includes('photos & videos') ||
              a.includes('photos and videos') ||
              a.includes('photos') ||
              t.includes('photo')
            )
            const isNotSticker = !t.includes('sticker') && !a.includes('sticker')
            return isPhotoOrVideo && isNotSticker
          }) || null
        }).then(h => h.asElement()).catch(() => null)

        if (photoMenuItem) {
          log('Found Photos & videos menu element!')
          const innerInput = await photoMenuItem.$('input[type="file"]').catch(() => null)
          if (innerInput) {
            log('Setting files directly on inner input of Photos & videos...')
            await innerInput.setInputFiles(tempFiles)
            fileSetDone = true
          } else {
            log('Triggering filechooser via Photos & videos click...')
            const [fileChooser] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null),
              photoMenuItem.click().catch(() => {})
            ])
            if (fileChooser) {
              log('Native fileChooser captured for Photos & videos! Setting files...')
              await fileChooser.setFiles(tempFiles)
              fileSetDone = true
            }
          }
        }

        // Priority 2: Direct file input query matching image or video, and NOT sticker
        if (!fileSetDone) {
          log('Searching DOM for photo/video input element...')
          const photoVideoInput = await page.evaluateHandle(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[]
            return inputs.find(inp => {
              const parentText = (inp.closest('button, div[role="button"], li, div')?.textContent || '').toLowerCase()
              const parentAria = (inp.closest('button, div[role="button"], li, div')?.getAttribute('aria-label') || '').toLowerCase()
              if (parentText.includes('sticker') || parentAria.includes('sticker')) return false
              const accept = (inp.accept || '').toLowerCase()
              return accept.includes('image') || accept.includes('video')
            }) || null
          }).then(h => h.asElement()).catch(() => null)

          if (photoVideoInput) {
            log('Found photo/video input! Setting files...')
            await photoVideoInput.setInputFiles(tempFiles)
            fileSetDone = true
          }
        }
      }
      
      if (!fileSetDone) {
        throw new Error(`Failed to attach media as ${sendAs}: Menu option or file input not found`)
      }
      
      // Step 3: Wait for WhatsApp Media Preview overlay
      log('Waiting for media preview modal to render...')
      await page.waitForSelector(
        '[data-icon*="send"]:not(footer *), [aria-label*="Send" i]:not(footer *), div[contenteditable="true"]:not(footer *)',
        { timeout: 8000 }
      ).catch(() => {})
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Handle STICKER specifically (no caption in WhatsApp sticker creator)
      if (sendAs === 'sticker') {
        log('Sending sticker from sticker creator modal...')
        let stickerSendBtn = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('[data-icon*="send"], [data-icon="wds-ic-send-filled"], [aria-label*="Send" i]'))
            .filter(el => !el.closest('footer'))
          for (const icon of btns) {
            const btn = icon.closest('button, div[role="button"]') || icon
            const r = btn.getBoundingClientRect()
            if (r.bottom > window.innerHeight * 0.5 && r.right > window.innerWidth * 0.5 && r.width >= 35) {
              return btn
            }
          }
          return btns[0] ? (btns[0].closest('button, div[role="button"]') || btns[0]) : null
        }).then(h => h.asElement()).catch(() => null)

        if (stickerSendBtn) {
          log('Found sticker creator Send button! Clicking...')
          await stickerSendBtn.click().catch(() => {})
        } else {
          await page.keyboard.press('Enter').catch(() => {})
        }

        // Wait for sticker creator modal to close
        log('Waiting for sticker upload to complete...')
        const waitStickerModalStart = Date.now()
        while (Date.now() - waitStickerModalStart < 15000) {
          const modalOpen = await page.evaluate(() => {
            const sendOutside = Array.from(document.querySelectorAll('[data-icon*="send"], [data-icon="wds-ic-send-filled"]'))
              .filter(el => !el.closest('footer'))
            return sendOutside.length > 0
          }).catch(() => false)
          if (!modalOpen) {
            log('Sticker creator modal closed - upload complete!')
            break
          }
          await new Promise(r => setTimeout(r, 400))
        }

        await new Promise(r => setTimeout(r, 1200))

        // If message text was also specified for sticker, send it as follow-up text
        if (message && message.trim()) {
          log('Sending accompanying text for sticker...')
          const textComposer = await page.$(
            'footer div[contenteditable="true"], div[contenteditable="true"][data-tab="10"]'
          ).catch(() => null)
          if (textComposer) {
            await textComposer.focus().catch(() => {})
            await page.keyboard.insertText(message).catch(() => {})
            await new Promise(r => setTimeout(r, 300))
            const sendBtn = await page.$(
              'footer [data-icon*="send"], footer [aria-label*="Send" i], [data-testid="compose-btn-send"]'
            ).catch(() => null)
            if (sendBtn) {
              await sendBtn.click().catch(() => {})
            } else {
              await page.keyboard.press('Enter').catch(() => {})
            }
            await new Promise(r => setTimeout(r, 1200))
          }
        }

        status.status = 'sent'
        log(`Sticker successfully sent to ${cleanNumber}!`)
        messageStatuses.set(messageId, status)
        return
      }

      // Step 4: Add Caption directly inside Media Preview (strictly outside footer)
      if (message && message.trim()) {
        log('Looking for caption input inside media preview (strictly outside footer)...')
        let captionHandle = null
        const captionStartTime = Date.now()
        
        while (Date.now() - captionStartTime < 8000) {
          captionHandle = await page.evaluateHandle(() => {
            // Find all contenteditable/textbox elements strictly NOT inside footer
            const editables = Array.from(document.querySelectorAll('div[contenteditable="true"], div[role="textbox"]'))
              .filter(el => !el.closest('footer'))
            
            if (editables.length === 0) return null
            // Select the one located in the lower half of the screen
            return editables.find(el => {
              const r = el.getBoundingClientRect()
              return r.bottom > window.innerHeight * 0.4 && r.width > 50
            }) || editables[0]
          }).then(h => h.asElement()).catch(() => null)

          if (captionHandle) break
          await new Promise(r => setTimeout(r, 400))
        }

        if (captionHandle) {
          log('Found media caption input element outside footer! Focusing and typing caption...')
          
          // Click into the caption box to place caret
          await captionHandle.click({ force: true }).catch(() => {})
          await new Promise(r => setTimeout(r, 250))
          
          // Clear any placeholder
          await page.keyboard.press('Control+A').catch(() => {})
          await page.keyboard.press('Backspace').catch(() => {})
          await new Promise(r => setTimeout(r, 100))
          
          // Try Playwright insertText first
          await page.keyboard.insertText(message).catch(() => {})
          await new Promise(r => setTimeout(r, 400))
          
          // Check if DOM text updated
          let verifiedText = await page.evaluate(el => el.textContent || el.innerText || '', captionHandle).catch(() => '')
          log(`Caption text in DOM after insertText: "${verifiedText}"`)
          
          // If insertText did not populate, use document.execCommand & InputEvent
          if (!verifiedText || !verifiedText.includes(message.trim().substring(0, 5))) {
            log('insertText did not reflect in DOM, triggering native execCommand & input events...')
            await page.evaluate(({ el, text }) => {
              (el as HTMLElement).focus();
              document.execCommand('selectAll', false);
              document.execCommand('delete', false);
              document.execCommand('insertText', false, text);
              el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }, { el: captionHandle, text: message }).catch(() => {})
            
            await new Promise(r => setTimeout(r, 400))
            verifiedText = await page.evaluate(el => el.textContent || el.innerText || '', captionHandle).catch(() => '')
            log(`Caption text in DOM after execCommand fallback: "${verifiedText}"`)
          }
          
          log(`Final verified caption before sending: "${verifiedText}"`)
        } else {
          errorLog('Could not find media caption input outside footer! Sending media without caption.')
        }
      }

      // Step 5: Locate and click Send on media preview (outside footer)
      log('Finding Send button on media preview (outside footer)...')
      let mediaSendBtn = await page.evaluateHandle(() => {
        // Find send button strictly outside footer in the bottom right area
        const sendElements = Array.from(document.querySelectorAll('[data-icon*="send"], [aria-label*="Send" i]'))
          .filter(el => !el.closest('footer'))
        
        for (const el of sendElements) {
          const btn = el.closest('button, div[role="button"]') || el
          const rect = btn.getBoundingClientRect()
          if (rect.bottom > window.innerHeight * 0.5 && rect.right > window.innerWidth * 0.4) {
            return btn
          }
        }
        return sendElements[0] ? (sendElements[0].closest('button, div[role="button"]') || sendElements[0]) : null
      }).then(h => h.asElement()).catch(() => null)

      if (!mediaSendBtn) {
        // Geometry fallback: bottom-right corner strictly outside footer
        mediaSendBtn = await page.evaluateHandle(() => {
          const candidates = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]'))
            .filter(el => !el.closest('footer'))
          let best = null
          let maxScore = -1
          for (const el of candidates) {
            const rect = el.getBoundingClientRect()
            if (rect.width >= 28 && rect.height >= 28 && rect.bottom > window.innerHeight * 0.6 && rect.right > window.innerWidth * 0.5) {
              const score = rect.bottom + rect.right
              if (score > maxScore) {
                maxScore = score
                best = el
              }
            }
          }
          return best
        }).then(handle => handle.asElement()).catch(() => null)
      }

      if (!mediaSendBtn) {
        throw new Error('WhatsApp media preview send button could not be located')
      }
      
      log('Clicking Send on media preview...')
      await mediaSendBtn.click().catch(async () => {
        await page.evaluate(el => (el as HTMLElement).click(), mediaSendBtn).catch(() => {})
      })
      
      // Step 6: Wait for upload to complete (preview modal disappears)
      log('Waiting for media upload to finish (waiting for preview modal to detach)...')
      const waitModalStart = Date.now()
      while (Date.now() - waitModalStart < 15000) {
        const stillOpen = await page.evaluate(() => {
          const previewEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'))
            .filter(el => !el.closest('footer'))
          return previewEditables.length > 0
        }).catch(() => false)
        
        if (!stillOpen) {
          log('Media preview modal closed - upload complete!')
          break
        }
        await new Promise(r => setTimeout(r, 400))
      }

      await new Promise(resolve => setTimeout(resolve, 1500))
      status.status = 'sent'
      log(`Media (Photo/Video/Doc + Caption) successfully sent to ${cleanNumber}!`)
    } else {
      // Regular text message
      log(`Sending text-only message to ${cleanNumber}...`)
      const sendButton = await page.$(
        '[data-testid="compose-btn-send"], [data-testid="send"], span[data-icon="send"], button[aria-label="Send"]'
      ).catch(() => null)
      
      if (sendButton) {
        await sendButton.click()
        log(`Message sent to ${cleanNumber}`)
        status.status = 'sent'
      } else {
        await page.keyboard.press('Enter')
        log(`Message sent via Enter to ${cleanNumber}`)
        status.status = 'sent'
      }
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Send failed'
    errorLog(`Failed to send message to ${phoneNumber}: ${errorMsg}`)
    status.status = 'failed'
    status.error = errorMsg
  } finally {
    // Clean up temporary files
    for (const f of tempFiles) {
      try { fs.unlinkSync(f) } catch (e) {}
    }
  }
  
  messageStatuses.set(messageId, status)
}


// Bulk send
app.post('/api/bulk-send', (req, res) => {
  const { messages, delayMs = 1000 } = req.body
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array required' })
  }
  
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Not connected to WhatsApp. Please authenticate first.' })
  }
  
  currentJobId = uuidv4()
  let delay = 0
  
  messages.forEach((msg: any, index: number) => {
    const id = msg.id || `${currentJobId}-${index}`
    const status: MessageStatus = {
      id,
      phoneNumber: msg.phoneNumber,
      status: 'pending',
      message: msg.message,
      timestamp: new Date()
    }
    messageStatuses.set(id, status)
    
    // Schedule sending
    setTimeout(() => {
      sendMessageToWhatsApp(msg.phoneNumber, msg.message, msg.file, id)
    }, delay)
    
    delay += delayMs
  })
  
  log(`Bulk job ${currentJobId} started with ${messages.length} messages`)
  
  res.json({
    jobId: currentJobId,
    totalMessages: messages.length,
    status: 'processing',
    mode: 'live'
  })
})

// Get message status
app.get('/api/message-status/:id', (req, res) => {
  const { id } = req.params
  const status = messageStatuses.get(id)
  res(status ? 200 : 404).json(status || { error: 'Not found' })
})

// Get bulk status
app.get('/api/bulk-status/:jobId', (req, res) => {
  const { jobId } = req.params
  const statuses = Array.from(messageStatuses.values())
    .filter(s => s.id.startsWith(jobId))
  
  res.json({
    jobId,
    messages: statuses,
    summary: {
      total: statuses.length,
      sent: statuses.filter(s => s.status === 'sent').length,
      failed: statuses.filter(s => s.status === 'failed').length,
      pending: statuses.filter(s => s.status === 'pending').length,
      sending: statuses.filter(s => s.status === 'sending').length
    }
  })
})

// Reset Session (clean wipe of .whatsapp-session and state)
app.post('/api/reset-session', async (req, res) => {
  log('Received request to completely reset WhatsApp session...')
  try {
    await clearSessionData()
    
    isAuthenticated = false
    qrCodeData = null
    lastCapturedRef = null
    lastCaptureTime = 0
    isInitializing = false
    currentJobId = null
    authMethod = null
    phoneNumberLinking = { active: false }
    messageStatuses.clear()
    
    res.json({ success: true, message: 'Session data cleared. Ready for fresh login.' })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

// Logout / Disconnect
app.post('/api/logout', async (req, res) => {
  log('Logging out from WhatsApp Web...')
  
  // Try to logout from WhatsApp Web properly
  if (page) {
    try {
      // Click on menu and logout
      const menuButton = await page.$('[data-testid="menu-top-bar"], header [aria-label="Menu"]')
      if (menuButton) {
        await menuButton.click()
        await new Promise(resolve => setTimeout(resolve, 800))
        
        const logoutButton = await page.$('li:has-text("Log out"), button:has-text("Log out"), [aria-label="Log out"]')
        if (logoutButton) {
          await logoutButton.click()
          await new Promise(resolve => setTimeout(resolve, 800))

          // Click confirmation button in dialog if present
          const confirmBtn = await page.$('div[role="dialog"] button:has-text("Log out"), [data-testid="popup-controls-ok"]')
          if (confirmBtn) {
            await confirmBtn.click()
            await new Promise(resolve => setTimeout(resolve, 1500))
          }
        }
      }
    } catch (e) {
      errorLog('Error during logout, continuing with session data wipe')
    }
  }
  
  // Close browser and wipe session data completely to avoid conflict with new accounts
  await clearSessionData()
  
  isAuthenticated = false
  qrCodeData = null
  lastCapturedRef = null
  lastCaptureTime = 0
  isInitializing = false
  currentJobId = null
  authMethod = null
  phoneNumberLinking = { active: false }
  messageStatuses.clear()
  
  res.json({ status: 'logged_out', message: 'Logged out and session cleared' })
})

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  errorLog(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
})

process.on('uncaughtException', (error) => {
  errorLog(`Uncaught Exception: ${error.message}`)
  console.error(error.stack)
})

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🚀  WhatsApp Blaster Service (Live Mode)      ║
║                                                  ║
║   Running: http://localhost:${PORT}                  ║
║   Mode:     Live (Real WhatsApp Web)             ║
║                                                  ║
║   Features:                                      ║
║   ✓ Real QR code from WhatsApp Web              ║
║   ✓ Phone number linking support               ║
║   ✓ Actual message sending                     ║
║   ✓ Bulk send support                          ║
║   ✓ Auto-reconnection                          ║
║                                                  ║
║   Endpoints:                                     ║
║   POST /api/init           Get QR code          ║
║   POST /api/init-phone     Link with phone       ║
║   GET  /api/qrcode         QR image             ║
║   POST /api/refresh-qr      Refresh QR           ║
║   GET  /api/status         Auth status          ║
║   GET  /api/auth-poll      Poll auth status     ║
║   POST /api/send-message   Send message         ║
║   POST /api/bulk-send      Bulk send            ║
║   GET  /api/message-status/:id                  ║
║   GET  /api/bulk-status/:jobId                  ║
║   POST /api/logout          Logout              ║
║                                                  ║
╚══════════════════════════════════════════════════╝
  `)
})

// Handle server errors
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    errorLog(`Port ${PORT} is already in use`)
    process.exit(1)
  } else {
    errorLog(`Server error: ${error.message}`)
  }
})

// Graceful shutdown
process.on('SIGINT', async () => {
  log('Received SIGINT, shutting down gracefully...')
  await closeBrowser()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  log('Received SIGTERM, shutting down gracefully...')
  await closeBrowser()
  process.exit(0)
})
