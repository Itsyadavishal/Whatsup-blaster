'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Send, 
  Upload, 
  Phone, 
  MessageSquare, 
  Image as ImageIcon, 
  FileText, 
  Zap, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Trash2,
  Plus,
  Globe,
  AlertCircle,
  QrCode,
  LogOut,
  Wifi,
  WifiOff,
  Loader2,
  Smartphone,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  Video,
  Music,
  Smile
} from 'lucide-react'

// Types
interface UploadedFile {
  id: string
  name: string
  size: string
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker'
  sendAs: 'photo' | 'document' | 'sticker' | 'video' | 'audio'
  preview?: string
  file: File
  dataUrl?: string // base64 for sending to backend
}

// Country codes for phone number input
const COUNTRY_CODES = [
  { code: '+1', country: 'US/CA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'Korea', flag: '🇰🇷' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
]

interface QueueItem {
  id: string
  phoneNumber: string
  message: string
  files: UploadedFile[]
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'not_registered' | 'rate_limited'
  error?: string
  timestamp: Date
}

// API Service - connects to WhatsApp automation backend via Next.js proxy
const API_BASE = '/api/whatsapp'

const whatsappAPI = {
  // Initialize WhatsApp and get QR code
  init: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/init`, { method: 'POST' })
    return res.json()
  },

  // Initialize with phone number linking
  initWithPhone: async (phoneNumber: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/init-phone`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phoneNumber })
    })
    return res.json()
  },

  // Get QR code image
  getQRCode: async (): Promise<Blob | null> => {
    try {
      const res = await fetch(`${API_BASE}/qrcode`)
      if (res.ok && res.headers.get('content-type')?.includes('image')) {
        return res.blob()
      }
      const data = await res.json()
      if (data.authenticated) return null
      return null
    } catch {
      return null
    }
  },

  // Refresh QR code
  refreshQR: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/refresh-qr`, { method: 'POST' })
    return res.json()
  },

  // Check authentication status
  getStatus: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/status`)
    return res.json()
  },

  // Poll for authentication completion
  pollAuth: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/auth-poll`)
    return res.json()
  },

  // Check if number is registered on WhatsApp
  checkNumber: async (phoneNumber: string): Promise<{registered: boolean, canMessage: boolean}> => {
    const res = await fetch(`${API_BASE}/check-number`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phoneNumber })
    })
    return res.json()
  },

  // Send single message
  sendMessage: async (phoneNumber: string, message: string, messageId: string, media?: Array<{data: string, name: string, type: string}>): Promise<any> => {
    const res = await fetch(`${API_BASE}/send-message`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phoneNumber, message, messageId, media, files: media })
    })
    return res.json()
  },

  // Send bulk messages
  bulkSend: async (messages: Array<{id: string, phoneNumber: string, message: string, media?: Array<{data: string, name: string, type: string}>}>, delayMs: number): Promise<any> => {
    const res = await fetch(`${API_BASE}/bulk-send`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ messages, delayMs })
    })
    return res.json()
  },

  // Get message status
  getMessageStatus: async (id: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/message-status/${id}`)
    return res.json()
  },

  // Logout
  logout: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/logout`, { method: 'POST' })
    return res.json()
  },

  // Reset session completely
  resetSession: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/reset-session`, { method: 'POST' })
    return res.json()
  }
}

export default function WhatsAppBlaster() {
  // State management
  const [message, setMessage] = useState('')
  const [phoneNumbers, setPhoneNumbers] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [speed, setSpeed] = useState([5]) // seconds between messages (default slower for real sending)
  const [isSending, setIsSending] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentProgress, setCurrentProgress] = useState(0)
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, notRegistered: 0 })
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authMethod, setAuthMethod] = useState<'qr' | 'phone' | null>(null)
  const [countryCode, setCountryCode] = useState('+1')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [phoneLinkingStatus, setPhoneLinkingStatus] = useState<string | null>(null)
  const [phoneLinkScreenshot, setPhoneLinkScreenshot] = useState<string | null>(null)
  const [qrInstructions, setQrInstructions] = useState<string[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const countryDropdownRef = useRef<HTMLDivElement>(null)
  const isProcessingRef = useRef(false)
  const authPollInterval = useRef<NodeJS.Timeout | null>(null)

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus()
    return () => {
      if (authPollInterval.current) {
        clearInterval(authPollInterval.current)
      }
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false)
      }
    }

    if (showCountryDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCountryDropdown])

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      const status = await whatsappAPI.getStatus()
      setIsAuthenticated(status.authenticated)
    } catch (error) {
      console.error('Failed to check auth status:', error)
    }
  }

  // Initialize WhatsApp and get QR code
  const initializeWhatsApp = async () => {
    setIsInitializing(true)
    setAuthError(null)
    setAuthMethod('qr')
    
    try {
      const result = await whatsappAPI.init()
      
      if (result.status === 'authenticated') {
        setIsAuthenticated(true)
        setQrCodeUrl(null)
      } else if (result.status === 'qr_code_required' || result.status === 'qr_pending') {
        setIsAuthenticated(false)
        if (result.qrCode) {
          setQrCodeUrl(result.qrCode)
        } else {
          // Fetch QR code image
          await fetchQRCode()
        }
        if (result.instructions) {
          setQrInstructions(result.instructions)
        }
        startAuthPolling()
      } else if (result.status === 'error') {
        setAuthError(result.error || result.message || 'Failed to initialize')
      } else if (result.status === 'initializing') {
        // Wait a bit and check again
        setTimeout(initializeWhatsApp, 2000)
      }
    } catch (error) {
      setAuthError('Failed to connect to WhatsApp service')
      console.error('Init error:', error)
    }
    
    setIsInitializing(false)
  }

  // Initialize with phone number
  const initializeWithPhone = async () => {
    const fullPhoneNumber = countryCode + phoneNumber.replace(/[^0-9]/g, '')
    
    if (fullPhoneNumber.length < 10) {
      setAuthError('Please enter a valid phone number')
      return
    }
    
    setIsInitializing(true)
    setAuthError(null)
    setAuthMethod('phone')
    setPhoneLinkingStatus('Initializing...')
    
    try {
      const result = await whatsappAPI.initWithPhone(fullPhoneNumber)
      
      if (result.status === 'authenticated') {
        setIsAuthenticated(true)
        setPhoneLinkingStatus(null)
      } else if (result.status === 'phone_linking') {
        setPhoneLinkingStatus('Check your phone for the verification code')
        if (result.screenshot) {
          setPhoneLinkScreenshot(result.screenshot)
        }
        if (result.instructions) {
          setQrInstructions(result.instructions)
        }
        startAuthPolling()
      } else if (result.status === 'error') {
        setAuthError(result.error || 'Failed to link phone')
        setPhoneLinkingStatus(null)
      }
    } catch (error) {
      setAuthError('Failed to connect to WhatsApp service')
      console.error('Phone init error:', error)
      setPhoneLinkingStatus(null)
    }
    
    setIsInitializing(false)
  }

  // Refresh QR code
  const refreshQRCode = async () => {
    setIsInitializing(true)
    try {
      const result = await whatsappAPI.refreshQR()
      if (result.status === 'qr_code_refreshed' && result.qrCode) {
        setQrCodeUrl(result.qrCode)
      } else {
        // Try full re-init
        await initializeWhatsApp()
      }
    } catch (error) {
      console.error('Refresh QR error:', error)
    }
    setIsInitializing(false)
  }

  // Fetch QR code image
  const fetchQRCode = async () => {
    try {
      const blob = await whatsappAPI.getQRCode()
      if (blob) {
        const url = URL.createObjectURL(blob)
        setQrCodeUrl(url)
      }
    } catch (error) {
      console.error('Failed to fetch QR code:', error)
    }
  }

  // Start polling for authentication
  const startAuthPolling = () => {
    if (authPollInterval.current) {
      clearInterval(authPollInterval.current)
    }
    
    authPollInterval.current = setInterval(async () => {
      try {
        const result = await whatsappAPI.pollAuth()
        if (result.authenticated) {
          setIsAuthenticated(true)
          setQrCodeUrl(null)
          setPhoneLinkingStatus(null)
          setPhoneLinkScreenshot(null)
          if (authPollInterval.current) {
            clearInterval(authPollInterval.current)
            authPollInterval.current = null
          }
        } else {
          // Keep QR code updated in real-time as WhatsApp rotates challenge tokens
          if (result.qrCode) {
            setQrCodeUrl(prev => (prev !== result.qrCode ? result.qrCode : prev))
          }
          if (result.qrExpired) {
            // Auto-refresh if flagged
            await refreshQRCode()
          }
        }
      } catch (error) {
        console.error('Auth poll error:', error)
      }
    }, 2000)
  }

  // Logout
  const handleLogout = async () => {
    try {
      await whatsappAPI.logout()
      setIsAuthenticated(false)
      setQrCodeUrl(null)
      setAuthMethod(null)
      setPhoneNumber('')
      setPhoneLinkingStatus(null)
      setPhoneLinkScreenshot(null)
      setQrInstructions([])
      if (authPollInterval.current) {
        clearInterval(authPollInterval.current)
        authPollInterval.current = null
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Reset session completely and refresh
  const handleResetSession = async () => {
    try {
      setIsInitializing(true)
      setAuthError(null)
      if (authPollInterval.current) {
        clearInterval(authPollInterval.current)
        authPollInterval.current = null
      }
      await whatsappAPI.resetSession()
      setIsAuthenticated(false)
      setQrCodeUrl(null)
      setAuthMethod(null)
      setPhoneNumber('')
      setPhoneLinkingStatus(null)
      setPhoneLinkScreenshot(null)
      setQrInstructions([])
      
      // Auto-reconnect with fresh browser session
      setTimeout(() => {
        initializeWhatsApp()
      }, 700)
    } catch (error) {
      console.error('Reset session error:', error)
      setAuthError('Failed to reset session. Please try again.')
      setIsInitializing(false)
    }
  }

  // Parse phone numbers from input
  const parsePhoneNumbers = useCallback(() => {
    return phoneNumbers
      .split(/[\n,\s]+/)
      .map(num => num.trim())
      .filter(num => num.length > 0 && /^\+?[\d\s()-]{7,15}$/.test(num.replace(/[\s()-]/g, '')))
  }, [phoneNumbers])

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
    })
  }

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files
    if (!uploadedFiles) return

    const newFiles: UploadedFile[] = []
    
    for (const file of Array.from(uploadedFiles)) {
      const dataUrl = await fileToBase64(file)
      const isImg = file.type.startsWith('image/')
      const isVid = file.type.startsWith('video/')
      const isAud = file.type.startsWith('audio/')
      
      const fileType: UploadedFile['type'] = isImg ? 'image' : isVid ? 'video' : isAud ? 'audio' : 'document'
      const defaultSendAs: UploadedFile['sendAs'] = isImg ? 'photo' : isVid ? 'video' : isAud ? 'audio' : 'document'

      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: formatFileSize(file.size),
        type: fileType,
        sendAs: defaultSendAs,
        preview: isImg ? URL.createObjectURL(file) : undefined,
        file,
        dataUrl
      })
    }

    setFiles(prev => [...prev, ...newFiles])
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Update send mode (photo, document, sticker, etc.)
  const updateFileSendAs = (id: string, sendAs: UploadedFile['sendAs']) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, sendAs } : f))
    setQueue(prev => prev.map(item => ({
      ...item,
      files: item.files.map(f => f.id === id ? { ...f, sendAs } : f)
    })))
  }

  // Remove file
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  // Build queue from inputs
  const buildQueue = () => {
    const numbers = parsePhoneNumbers()
    if (numbers.length === 0) {
      alert('Please enter valid phone numbers')
      return
    }
    
    if (!message.trim() && files.length === 0) {
      alert('Please enter a message or upload files')
      return
    }

    const newQueue: QueueItem[] = numbers.map((num, index) => ({
      id: `msg-${index}-${Date.now()}`,
      phoneNumber: num,
      message: message,
      files: [...files],
      status: 'pending',
      timestamp: new Date()
    }))

    setQueue(newQueue)
    setStats({ total: newQueue.length, sent: 0, failed: 0, notRegistered: 0 })
    setCurrentProgress(0)
  }

  // Process queue - actually sends messages via backend
  const processQueue = async () => {
    if (queue.length === 0) {
      alert('Please build the queue first')
      return
    }

    if (!isAuthenticated) {
      alert('Please authenticate with WhatsApp first by scanning the QR code')
      return
    }

    setIsSending(true)
    setIsPaused(false)
    isProcessingRef.current = true

    let sentCount = 0
    let failedCount = 0
    let notRegisteredCount = 0

    for (let i = 0; i < queue.length; i++) {
      if (!isProcessingRef.current) break

      while (isPaused && isProcessingRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (!isProcessingRef.current) break

      // Update current item status to sending
      setQueue(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: 'sending' as const } : item
      ))

      try {
        const item = queue[i]
        
        // Prepare media array if files exist
        const media = item.files.map(f => ({
          data: f.dataUrl!,
          name: f.name,
          type: f.file.type,
          sendAs: f.sendAs || (f.type === 'image' ? 'photo' : f.type === 'video' ? 'video' : 'document')
        }))
        
        // Send via backend API (actually clicks send button and attaches media!)
        const result = await whatsappAPI.sendMessage(
          item.phoneNumber, 
          item.message, 
          item.id,
          media
        )
        
        // Update status based on actual result from backend
        let newStatus: QueueItem['status'] = 'sent'
        let errorMsg: string | undefined
        
        if (result.status === 'sent') {
          newStatus = 'sent'
          sentCount++
        } else if (result.status === 'not_registered') {
          newStatus = 'not_registered'
          errorMsg = result.error || 'Number not registered on WhatsApp'
          notRegisteredCount++
        } else if (result.status === 'failed') {
          newStatus = 'failed'
          errorMsg = result.error || 'Sending failed'
          failedCount++
        } else {
          // Fallback based on success field
          if (result.success) {
            newStatus = 'sent'
            sentCount++
          } else {
            newStatus = 'failed'
            errorMsg = result.error || 'Unknown error'
            failedCount++
          }
        }
        
        // Update queue with final status
        setQueue(prev => prev.map((itemIdx, idx) => 
          idx === i ? { ...itemIdx, status: newStatus, error: errorMsg } : itemIdx
        ))
        
      } catch (error) {
        // Network/API error
        setQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'failed' as const, error: String(error) } : item
        ))
        failedCount++
      }

      setStats({ 
        total: queue.length, 
        sent: sentCount, 
        failed: failedCount,
        notRegistered: notRegisteredCount
      })
      setCurrentProgress(((i + 1) / queue.length) * 100)

      // Wait before next message (respecting speed setting)
      if (i < queue.length - 1 && isProcessingRef.current) {
        await new Promise(resolve => setTimeout(resolve, speed[0] * 1000))
      }
    }

    setIsSending(false)
    isProcessingRef.current = false
  }

  // Pause/Resume sending
  const togglePause = () => {
    setIsPaused(!isPaused)
  }

  // Stop sending
  const stopSending = () => {
    isProcessingRef.current = false
    setIsSending(false)
    setIsPaused(false)
  }

  // Reset everything
  const resetAll = () => {
    if (isSending) {
      stopSending()
    }
    setQueue([])
    setCurrentProgress(0)
    setStats({ total: 0, sent: 0, failed: 0, notRegistered: 0 })
  }

  // Get speed label
  const getSpeedLabel = (value: number) => {
    if (value <= 2) return 'Fast (2s)'
    if (value <= 5) return 'Normal (5s)'
    if (value <= 8) return 'Slow (8s)'
    return 'Very Slow (10s)'
  }

  // Get status icon and color
  const getStatusStyle = (status: QueueItem['status']) => {
    switch (status) {
      case 'sent':
        return {
          bg: 'bg-green-50 border-green-200',
          badge: 'bg-green-100 text-green-700',
          icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
          circle: 'bg-green-100 text-green-700'
        }
      case 'failed':
        return {
          bg: 'bg-red-50 border-red-200',
          badge: 'bg-red-100 text-red-700',
          icon: <XCircle className="w-5 h-5 text-red-600" />,
          circle: 'bg-red-100 text-red-700'
        }
      case 'not_registered':
        return {
          bg: 'bg-orange-50 border-orange-200',
          badge: 'bg-orange-100 text-orange-700',
          icon: <AlertCircle className="w-5 h-5 text-orange-600" />,
          circle: 'bg-orange-100 text-orange-700'
        }
      case 'sending':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          badge: 'bg-yellow-100 text-yellow-700',
          icon: <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />,
          circle: 'bg-yellow-100 text-yellow-700'
        }
      default:
        return {
          bg: 'bg-gray-50 border-gray-200',
          badge: 'bg-gray-100 text-gray-700',
          icon: null,
          circle: 'bg-gray-200 text-gray-600'
        }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="bg-white border-b border-green-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
                <MessageSquare className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">WhatsApp Blaster</h1>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  {isAuthenticated ? (
                    <>
                      <Wifi className="w-3 h-3 text-green-500" />
                      Connected to WhatsApp
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-gray-400" />
                      Not connected
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Button 
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              ) : (
                <Button 
                  onClick={initializeWhatsApp}
                  disabled={isInitializing}
                  size="sm"
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  {isInitializing ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4 mr-1" />
                  )}
                  Connect WhatsApp
                </Button>
              )}
              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                <Globe className="w-3 h-3 mr-1" />
                Auto-Send v2
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Auth Section - Choose Method */}
        {!isAuthenticated && !qrCodeUrl && !isInitializing && !phoneLinkingStatus && (
          <Card className="mb-6 border-blue-200 bg-gradient-to-br from-blue-50 to-green-50 overflow-hidden">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-200">
                  <MessageSquare className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Connect to WhatsApp</h3>
                <p className="text-gray-600 max-w-lg mx-auto">
                  Choose your preferred method to connect WhatsApp Web for automatic message sending.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {/* QR Code Option */}
                <Card className="border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition-all cursor-pointer group" onClick={initializeWhatsApp}>
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <QrCode className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Scan QR Code</h4>
                    <p className="text-sm text-gray-500">
                      Point your phone camera at the QR code to connect instantly
                    </p>
                  </CardContent>
                </Card>
                
                {/* Phone Number Option */}
                <Card className="border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">Link with Phone Number</h4>
                    <p className="text-xs text-gray-500 mb-3">
                      Get a code sent to your phone to link manually
                    </p>
                    <div className="flex gap-2 relative" ref={countryDropdownRef}>
                      {/* Country Code Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                          className="flex items-center gap-1 px-2 py-2 text-sm border border-gray-300 rounded-l-lg bg-gray-50 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 outline-none min-w-[80px] justify-between"
                        >
                          <span>{COUNTRY_CODES.find(c => c.code === countryCode)?.flag || '🌐'} {countryCode}</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        
                        {showCountryDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                            <div className="p-2 border-b">
                              <input
                                type="text"
                                placeholder="Search country..."
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded outline-none focus:border-blue-500"
                                autoFocus
                              />
                            </div>
                            {COUNTRY_CODES.map((country) => (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => {
                                  setCountryCode(country.code)
                                  setShowCountryDropdown(false)
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 text-left ${countryCode === country.code ? 'bg-blue-100 text-blue-700' : ''}`}
                              >
                                <span>{country.flag}</span>
                                <span className="font-medium">{country.code}</span>
                                <span className="text-gray-500 ml-auto">{country.country}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <input
                        type="tel"
                        placeholder="Phone number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border-t border-b border-r border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && initializeWithPhone()}
                      />
                      <Button 
                        onClick={initializeWithPhone}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                      >
                        Link
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Code Display */}
        {qrCodeUrl && !isAuthenticated && (
          <Card className="mb-6 border-green-200 bg-white shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-green-800 flex items-center justify-center gap-2">
                    <QrCode className="w-6 h-6" />
                    Scan QR Code with WhatsApp
                  </CardTitle>
                  <CardDescription>
                    Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={refreshQRCode}
                    variant="outline" 
                    size="sm"
                    className="border-green-300 text-green-700 hover:bg-green-50"
                    disabled={isInitializing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${isInitializing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button 
                    onClick={handleResetSession}
                    variant="outline" 
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    disabled={isInitializing}
                    title="Clear cached session data and generate a fresh QR code"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Reset Session
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {/* Live sync pulse badge */}
              <div className="mb-3 flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-800 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live QR Sync: Token refreshes automatically every ~20s</span>
              </div>

              <div className="p-4 bg-white rounded-xl border-2 border-dashed border-green-300 mb-4 relative">
                {/* QR Code Image */}
                <img 
                  src={qrCodeUrl} 
                  alt="WhatsApp QR Code - Scan this with your phone" 
                  className="w-72 h-72 object-contain"
                />
              </div>
              
              {/* Instructions */}
              {qrInstructions.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg w-full max-w-md">
                  <p className="text-sm font-medium text-blue-800 mb-2">How to scan:</p>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    {qrInstructions.map((instruction, idx) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Note on QR Code Expiration & Live Sync */}
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg w-full max-w-md text-xs text-blue-900 shadow-sm">
                <p className="font-semibold mb-1 flex items-center gap-1.5 text-blue-900">
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  Why do WhatsApp QR codes expire?
                </p>
                <p className="text-blue-800 leading-relaxed">
                  WhatsApp rotates security pairing tokens every 20-30 seconds. Scanning an older code causes <i>&quot;Couldn&apos;t connect&quot;</i> on your phone. With <b>Live QR Sync</b>, this screen continuously streams the latest active code so your scan connects instantly.
                </p>
              </div>

              {/* Troubleshooting Note for "Can't link device" */}
              <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg w-full max-w-md text-xs text-amber-900 shadow-sm">
                <p className="font-semibold mb-1 flex items-center gap-1.5 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  Getting &quot;Can&apos;t link to a new device right now&quot; on your phone?
                </p>
                <ul className="list-disc list-inside space-y-1 text-amber-800 ml-1 mt-1">
                  <li>Check WhatsApp on your phone: <b>Settings &rarr; Linked Devices</b>. Ensure you haven&apos;t reached the 4-device limit.</li>
                  <li>Click <b>Reset Session</b> above to wipe old session cache and create a clean pairing code.</li>
                  <li>Alternatively, click <b>Try phone linking instead</b> below to link using an 8-character code.</li>
                </ul>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Waiting for scan...</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setQrCodeUrl(null)
                    setAuthMethod(null)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Try phone linking instead
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Phone Linking Status */}
        {phoneLinkingStatus && !isAuthenticated && (
          <Card className="mb-6 border-blue-200 bg-white shadow-lg">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-blue-800 flex items-center justify-center gap-2">
                <Smartphone className="w-6 h-6" />
                Phone Number Linking
              </CardTitle>
              <CardDescription>
                Follow the instructions on your phone to complete linking
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {phoneLinkScreenshot && (
                <div className="p-4 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 mb-4 max-w-full overflow-hidden">
                  <img 
                    src={phoneLinkScreenshot} 
                    alt="Phone linking screen" 
                    className="max-w-full max-h-96 object-contain"
                  />
                </div>
              )}
              
              {/* Instructions */}
              {qrInstructions.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg w-full max-w-md">
                  <p className="text-sm font-medium text-blue-800 mb-2">Next steps:</p>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    {qrInstructions.map((instruction, idx) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ol>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{phoneLinkingStatus}</span>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setPhoneLinkingStatus(null)
                  setPhoneLinkScreenshot(null)
                  setAuthMethod(null)
                }}
                className="mt-3 text-gray-500 hover:text-gray-700"
              >
                Try QR code instead
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Initializing Spinner */}
        {isInitializing && (
          <Card className="mb-6 border-gray-200">
            <CardContent className="p-8 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {authMethod === 'phone' ? 'Linking your phone...' : 'Connecting to WhatsApp...'}
              </h3>
              <p className="text-gray-600">
                {authMethod === 'phone' 
                  ? 'Opening WhatsApp Web and initiating phone linking...' 
                  : 'Loading WhatsApp Web and generating QR code...'
                }
              </p>
              <p className="text-xs text-gray-400 mt-2">This may take 10-30 seconds</p>
            </CardContent>
          </Card>
        )}

        {/* Auth Error */}
        {authError && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900">Connection Error</p>
                <p className="text-sm text-red-700">{authError}</p>
              </div>
              <Button 
                onClick={initializeWhatsApp} 
                variant="outline" 
                size="sm"
                className="ml-auto border-red-300 text-red-700"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Input Section */}
          <div className="space-y-6">
            {/* Message Input Card */}
            <Card className="border-green-100 shadow-lg shadow-green-50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <MessageSquare className="w-5 h-5" />
                  Message Content
                </CardTitle>
                <CardDescription>
                  Write your message or upload media to send
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Type your message here...&#10;&#10;Supports multiple lines and emojis 🎉&#10;&#10;Messages will be SENT AUTOMATICALLY!"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!isAuthenticated}
                  className={`min-h-[150px] resize-none ${
                    isAuthenticated 
                      ? 'border-green-200 focus:border-green-400 focus:ring-green-200' 
                      : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  }`}
                />
                
                {/* Character count */}
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{message.length} characters</span>
                  <span>{message.split(/\s+/).filter(w => w.length > 0).length} words</span>
                </div>

                {/* File Upload Area */}
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  isAuthenticated 
                    ? 'border-green-200 bg-green-50/50 hover:border-green-400 cursor-pointer' 
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                }`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={!isAuthenticated}
                  />
                  <label htmlFor={isAuthenticated ? "file-upload" : ""} className={`cursor-${isAuthenticated ? 'pointer' : 'default'}`}>
                    <Upload className={`w-10 h-10 mx-auto mb-2 ${isAuthenticated ? 'text-green-400' : 'text-gray-300'}`} />
                    <p className={`text-sm font-medium ${isAuthenticated ? 'text-gray-700' : 'text-gray-400'}`}>
                      Click to upload photos, videos, audio, or documents
                    </p>
                    <p className={`text-xs mt-1 ${isAuthenticated ? 'text-gray-500' : 'text-gray-400'}`}>
                      Photos, Videos, Audio, PDF, DOC, TXT (Choose mode: Photo, Sticker, or Document)
                      {!isAuthenticated && ' (Connect WhatsApp first)'}
                    </p>
                  </label>
                </div>

                {/* Uploaded Files List */}
                {files.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100/70 border border-gray-100 rounded-lg gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {file.type === 'image' ? (
                            <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          ) : file.type === 'video' ? (
                            <Video className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          ) : file.type === 'audio' ? (
                            <Music className="w-4 h-4 text-pink-500 flex-shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          )}
                          <span className="text-sm truncate font-medium text-gray-800">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Send As Selector */}
                          <select
                            value={file.sendAs}
                            onChange={(e) => updateFileSendAs(file.id, e.target.value as UploadedFile['sendAs'])}
                            className="text-xs bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 font-semibold focus:ring-1 focus:ring-green-400 outline-none cursor-pointer shadow-xs"
                          >
                            {file.type === 'image' && (
                              <>
                                <option value="photo">📷 Photo</option>
                                <option value="document">📄 Document (HD)</option>
                                <option value="sticker">🎨 Sticker</option>
                              </>
                            )}
                            {file.type === 'video' && (
                              <>
                                <option value="video">🎥 Video</option>
                                <option value="document">📄 Document</option>
                              </>
                            )}
                            {file.type === 'audio' && (
                              <>
                                <option value="audio">🎵 Audio</option>
                                <option value="document">📄 Document</option>
                              </>
                            )}
                            {file.type === 'document' && (
                              <>
                                <option value="document">📄 Document</option>
                              </>
                            )}
                          </select>
                          <span className="text-xs text-gray-400">({file.size})</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(file.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Phone Numbers Card */}
            <Card className="border-green-100 shadow-lg shadow-green-50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Phone className="w-5 h-5" />
                  Recipient Numbers
                </CardTitle>
                <CardDescription>
                  Enter phone numbers (one per line or comma-separated)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="+1234567890&#10;+1987654321&#10;+15551234567&#10;&#10;Or comma-separated: +1234567890, +1987654321"
                  value={phoneNumbers}
                  onChange={(e) => setPhoneNumbers(e.target.value)}
                  disabled={!isAuthenticated}
                  className={`min-h-[120px] resize-none font-mono text-sm ${
                    isAuthenticated 
                      ? 'border-green-200 focus:border-green-400 focus:ring-green-200' 
                      : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  }`}
                />
                
                {/* Number stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{parsePhoneNumbers().length} valid numbers</span>
                  </div>
                  {phoneNumbers.split(/[\n,\s]+/).filter(n => n.trim()).length !== parsePhoneNumbers().length && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>Some invalid formats detected</span>
                    </div>
                  )}
                </div>

                {/* Speed Control */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Sending Speed
                    </label>
                    <Badge variant="outline" className="text-xs">
                      {getSpeedLabel(speed[0])}
                    </Badge>
                  </div>
                  <Slider
                    value={speed}
                    onValueChange={setSpeed}
                    max={10}
                    min={2}
                    step={1}
                    className="py-2"
                    disabled={!isAuthenticated}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Fast (2s)</span>
                    <span>Slow (10s)</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    ⚠️ Real auto-sending needs delays to avoid being blocked by WhatsApp
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Queue & Control Section */}
          <div className="space-y-6">
            {/* Control Panel */}
            <Card className="border-green-100 shadow-lg shadow-green-50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Send className="w-5 h-5" />
                  Control Panel
                </CardTitle>
                <CardDescription>
                  Build your queue and start auto-sending
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={buildQueue}
                    disabled={isSending || !isAuthenticated || parsePhoneNumbers().length === 0}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-200 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Build Queue
                  </Button>
                  <Button
                    onClick={processQueue}
                    disabled={isSending || queue.length === 0 || !isAuthenticated}
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Auto Send
                  </Button>
                </div>

                {/* Progress Bar */}
                {(isSending || currentProgress > 0) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium text-green-700">{Math.round(currentProgress)}%</span>
                    </div>
                    <Progress value={currentProgress} className="h-3 bg-green-100" />
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-2 mt-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl font-bold text-blue-700">{stats.total}</div>
                    <div className="text-xs text-blue-600">Total</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-700">{stats.sent}</div>
                    <div className="text-xs text-green-600">Sent ✓</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-xl font-bold text-red-700">{stats.failed}</div>
                    <div className="text-xs text-red-600">Failed ✗</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-xl font-bold text-orange-700">{stats.notRegistered}</div>
                    <div className="text-xs text-orange-600">No WA</div>
                  </div>
                </div>

                {/* Pause/Stop Controls */}
                {isSending && (
                  <div className="flex gap-3">
                    <Button
                      onClick={togglePause}
                      variant="outline"
                      className="flex-1 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    >
                      {isPaused ? (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={stopSending}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  </div>
                )}

                <Button
                  onClick={resetAll}
                  disabled={isSending}
                  variant="ghost"
                  className="w-full text-gray-500 hover:text-gray-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset All
                </Button>
              </CardContent>
            </Card>

            {/* Queue Preview */}
            <Card className="border-green-100 shadow-lg shadow-green-50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <Clock className="w-5 h-5" />
                    Message Queue
                  </CardTitle>
                  {queue.length > 0 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      {queue.length} messages
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {queue.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No messages in queue</p>
                    <p className="text-xs mt-1">
                      {isAuthenticated 
                        ? 'Build your queue to get started' 
                        : 'Connect WhatsApp first, then build your queue'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {queue.map((item, index) => {
                      const style = getStatusStyle(item.status)
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-lg border transition-all ${style.bg}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium ${style.circle}`}>
                                {style.icon || (index + 1)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm text-gray-900 truncate">
                                  {item.phoneNumber}
                                </p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                  {item.message.substring(0, 60)}
                                  {item.message.length > 60 ? '...' : ''}
                                </p>
                                {item.files.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <ImageIcon className="w-3 h-3 text-gray-400" />
                                    <span className="text-xs text-gray-400">
                                      {item.files.length} file(s) attached
                                    </span>
                                  </div>
                                )}
                                {item.error && (
                                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {item.error}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs flex-shrink-0 ml-2 ${style.badge}`}
                            >
                              {item.status === 'not_registered' ? 'Not Registered' : 
                               item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="mt-6 border-blue-100 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How it works (v2 - Auto-Send Edition):</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li><strong>Connect to WhatsApp:</strong> Scan QR code to link your account</li>
                  <li><strong>Real Auto-Sending:</strong> Messages are sent automatically via browser automation</li>
                  <li><strong>Smart Error Detection:</strong> Detects unregistered numbers and shows proper errors</li>
                  <li><strong>Rate Limiting:</strong> Built-in delays prevent WhatsApp from blocking you</li>
                  <li><strong>Status Tracking:</strong> See exactly which messages were sent, failed, or skipped</li>
                  <li>Phone numbers must include country code (e.g., +1 for US)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-green-100 bg-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>WhatsApp Blaster v2 • Auto-Send Edition • Use responsibly and respect privacy laws</p>
        </div>
      </footer>
    </div>
  )
}
