'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
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
  Smile,
  Sun,
  Moon,
  FileSpreadsheet,
  UserPlus,
  Edit3,
  Download,
  X
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
  dataUrl?: string
}

interface Contact {
  id: string
  name: string
  phoneNumber: string
  countryCode: string
  isEditing: boolean
}

// Country codes for phone number input - India first by default
const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'US/CA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
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

// API Service
const API_BASE = '/api/whatsapp'

const whatsappAPI = {
  init: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/init`, { method: 'POST' })
    return res.json()
  },

  initWithPhone: async (phoneNumber: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/init-phone`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phoneNumber })
    })
    return res.json()
  },

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

  refreshQR: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/refresh-qr`, { method: 'POST' })
    return res.json()
  },

  getStatus: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/status`)
    return res.json()
  },

  pollAuth: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/auth-poll`)
    return res.json()
  },

  checkNumber: async (phoneNumber: string): Promise<{registered: boolean, canMessage: boolean}> => {
    const res = await fetch(`${API_BASE}/check-number`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phoneNumber })
    })
    return res.json()
  },

  sendMessage: async (phoneNumber: string, message: string, messageId: string, media?: Array<{data: string, name: string, type: string}>): Promise<any> => {
    const res = await fetch(`${API_BASE}/send-message`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phoneNumber, message, messageId, media, files: media })
    })
    return res.json()
  },

  bulkSend: async (messages: Array<{id: string, phoneNumber: string, message: string, media?: Array<{data: string, name: string, type: string}>}>, delayMs: number): Promise<any> => {
    const res = await fetch(`${API_BASE}/bulk-send`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ messages, delayMs })
    })
    return res.json()
  },

  getMessageStatus: async (id: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/message-status/${id}`)
    return res.json()
  },

  logout: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/logout`, { method: 'POST' })
    return res.json()
  },

  resetSession: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/reset-session`, { method: 'POST' })
    return res.json()
  }
}

export default function WhatsAppBlaster() {
  const { theme, setTheme } = useTheme()
  
  // State management
  const [message, setMessage] = useState('')
  const [phoneNumbers, setPhoneNumbers] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [speed, setSpeed] = useState([5])
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
  const [countryCode, setCountryCode] = useState('+91') // Default to India
  const [phoneNumber, setPhoneNumber] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [phoneLinkingStatus, setPhoneLinkingStatus] = useState<string | null>(null)
  const [phoneLinkScreenshot, setPhoneLinkScreenshot] = useState<string | null>(null)
  const [qrInstructions, setQrInstructions] = useState<string[]>([])

  // Contact file upload state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contactFileInputRef = useRef<HTMLInputElement>(null)
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
          await fetchQRCode()
        }
        if (result.instructions) {
          setQrInstructions(result.instructions)
        }
        startAuthPolling()
      } else if (result.status === 'error') {
        setAuthError(result.error || result.message || 'Failed to initialize')
      } else if (result.status === 'initializing') {
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
          if (result.qrCode) {
            setQrCodeUrl(prev => (prev !== result.qrCode ? result.qrCode : prev))
          }
          if (result.qrExpired) {
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

  // Handle media file upload
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
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle contact file upload (CSV/Excel)
  const handleContactFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return

    const fileExtension = uploadedFile.name.split('.').pop()?.toLowerCase()
    
    try {
      let parsedContacts: Contact[] = []

      if (fileExtension === 'csv') {
        // Parse CSV using PapaParse
        const text = await uploadedFile.text()
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.toLowerCase().trim()
        })

        parsedContacts = (result.data as Record<string, string>[]).map((row, index) => {
          // Try different possible column names for name
          const name = row['name'] || row['contact'] || row['customer'] || row['person'] || row['full name'] || `Contact ${index + 1}`
          
          // Try different possible column names for phone
          let phone = row['phone'] || row['phone number'] || row['phonenumber'] || row['mobile'] || row['telephone'] || row['tel'] || row['number'] || ''
          
          // Clean up the phone number
          phone = phone.replace(/[^+\d]/g, '')
          
          // Detect or extract country code
          let detectedCountryCode = '+91' // Default to India
          let cleanPhone = phone

          if (phone.startsWith('+')) {
            // Find the country code
            for (const country of COUNTRY_CODES) {
              if (phone.startsWith(country.code)) {
                detectedCountryCode = country.code
                cleanPhone = phone.substring(country.code.length)
                break
              }
            }
            if (cleanPhone === phone) {
              // No matching country code found, use as-is
              cleanPhone = phone
              detectedCountryCode = ''
            }
          }

          // Also check for country column
          const countryFromColumn = row['country'] || row['country code'] || ''
          if (countryFromColumn) {
            const matchedCountry = COUNTRY_CODES.find(c => 
              c.country.toLowerCase() === countryFromColumn.toLowerCase() ||
              c.code === countryFromColumn ||
              c.flag === countryFromColumn
            )
            if (matchedCountry) {
              detectedCountryCode = matchedCountry.code
            }
          }

          return {
            id: `contact-${Date.now()}-${index}`,
            name: name.trim(),
            phoneNumber: cleanPhone,
            countryCode: detectedCountryCode,
            isEditing: false
          }
        }).filter(c => c.phoneNumber.length >= 6) // Filter out invalid entries
      } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
        // Parse Excel file
        const arrayBuffer = await uploadedFile.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]

        if (jsonData.length > 0) {
          // Get headers from first row
          const headers = jsonData[0].map((h: string) => (h || '').toLowerCase().trim())
          
          // Find column indices
          const nameIndex = headers.findIndex(h => 
            ['name', 'contact', 'customer', 'person', 'full name'].includes(h)
          )
          const phoneIndex = headers.findIndex(h => 
            ['phone', 'phone number', 'phonenumber', 'mobile', 'telephone', 'tel', 'number'].includes(h)
          )
          const countryIndex = headers.findIndex(h => 
            ['country', 'country code'].includes(h)
          )

          // Parse data rows (skip header)
          parsedContacts = jsonData.slice(1).filter((row: string[]) => 
            row.length > Math.max(nameIndex, phoneIndex) && 
            row[phoneIndex]
          ).map((row: string[], index: number) => {
            const name = nameIndex >= 0 ? (row[nameIndex] || `Contact ${index + 1}`) : `Contact ${index + 1}`
            let phone = (row[phoneIndex] || '').replace(/[^+\d]/g, '')
            
            let detectedCountryCode = '+91'
            let cleanPhone = phone

            if (phone.startsWith('+')) {
              for (const country of COUNTRY_CODES) {
                if (phone.startsWith(country.code)) {
                  detectedCountryCode = country.code
                  cleanPhone = phone.substring(country.code.length)
                  break
                }
              }
              if (cleanPhone === phone) {
                cleanPhone = phone
                detectedCountryCode = ''
              }
            }

            if (countryIndex >= 0 && row[countryIndex]) {
              const matchedCountry = COUNTRY_CODES.find(c => 
                c.country.toLowerCase() === row[countryIndex].toLowerCase() ||
                c.code === row[countryIndex] ||
                c.flag === row[countryIndex]
              )
              if (matchedCountry) {
                detectedCountryCode = matchedCountry.code
              }
            }

            return {
              id: `contact-${Date.now()}-${index}`,
              name: String(name).trim(),
              phoneNumber: cleanPhone,
              countryCode: detectedCountryCode,
              isEditing: false
            }
          }).filter(c => c.phoneNumber.length >= 6)
        }
      }

      setContacts(parsedContacts)
      // Select all contacts by default
      setSelectedContacts(new Set(parsedContacts.map(c => c.id)))
    } catch (error) {
      console.error('Error parsing contact file:', error)
      setAuthError('Failed to parse contact file. Please check the format.')
    }

    // Reset input
    if (contactFileInputRef.current) {
      contactFileInputRef.current.value = ''
    }
  }

  // Drag and drop handlers for contacts
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      // Create a new FileList-like object and trigger the handler
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(droppedFile)
      const input = document.createElement('input')
      input.type = 'file'
      input.files = dataTransfer.files
      handleContactFileUpload({ target: input } as React.ChangeEvent<HTMLInputElement>)
    }
  }

  // Auto-detect country code from pasted number
  const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    if (pastedText.startsWith('+')) {
      for (const country of COUNTRY_CODES) {
        if (pastedText.startsWith(country.code)) {
          setCountryCode(country.code)
          setPhoneNumber(pastedText.substring(country.code.length))
          e.preventDefault()
          break
        }
      }
    }
  }

  // Update send mode
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

  // Contact editing functions
  const updateContact = (id: string, field: keyof Contact, value: string) => {
    setContacts(prev => prev.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ))
  }

  const toggleEditContact = (id: string) => {
    setContacts(prev => prev.map(c => 
      c.id === id ? { ...c, isEditing: !c.isEditing } : c
    ))
  }

  const deleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id))
    setSelectedContacts(prev => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  const toggleSelectContact = (id: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const selectAllContacts = () => {
    const filteredIds = getFilteredContacts().map(c => c.id)
    setSelectedContacts(new Set(filteredIds))
  }

  const deselectAllContacts = () => {
    setSelectedContacts(new Set())
  }

  const addContactsToPhoneNumbers = () => {
    const selectedContactsList = contacts.filter(c => selectedContacts.has(c.id))
    const numbers = selectedContactsList
      .map(c => `${c.countryCode}${c.phoneNumber}`)
      .join('\n')
    
    if (phoneNumbers.trim()) {
      setPhoneNumbers(prev => prev.trim() + '\n' + numbers)
    } else {
      setPhoneNumbers(numbers)
    }
  }

  const clearContacts = () => {
    setContacts([])
    setSelectedContacts(new Set())
  }

  // Get filtered contacts based on search
  const getFilteredContacts = () => {
    if (!contactSearchTerm) return contacts
    const term = contactSearchTerm.toLowerCase()
    return contacts.filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.phoneNumber.includes(term) ||
      c.countryCode.includes(term)
    )
  }

  // Build queue from inputs
  const buildQueue = () => {
    const numbers = parsePhoneNumbers()
    if (numbers.length === 0) {
      alert('Please enter valid phone numbers or add contacts')
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

  // Process queue
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

      setQueue(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: 'sending' as const } : item
      ))

      try {
        const item = queue[i]
        
        const media = item.files.map(f => ({
          data: f.dataUrl!,
          name: f.name,
          type: f.file.type,
          sendAs: f.sendAs || (f.type === 'image' ? 'photo' : f.type === 'video' ? 'video' : 'document')
        }))
        
        const result = await whatsappAPI.sendMessage(
          item.phoneNumber, 
          item.message, 
          item.id,
          media
        )
        
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
          if (result.success) {
            newStatus = 'sent'
            sentCount++
          } else {
            newStatus = 'failed'
            errorMsg = result.error || 'Unknown error'
            failedCount++
          }
        }
        
        setQueue(prev => prev.map((itemIdx, idx) => 
          idx === i ? { ...itemIdx, status: newStatus, error: errorMsg } : itemIdx
        ))
        
      } catch (error) {
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

  // Get status style
  const getStatusStyle = (status: QueueItem['status']) => {
    switch (status) {
      case 'sent':
        return {
          bg: 'dark:bg-green-950/30 bg-green-50 border-green-200 dark:border-green-800',
          badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
          icon: <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />,
          circle: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
        }
      case 'failed':
        return {
          bg: 'dark:bg-red-950/30 bg-red-50 border-red-200 dark:border-red-800',
          badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
          icon: <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
          circle: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
        }
      case 'not_registered':
        return {
          bg: 'dark:bg-orange-950/30 bg-orange-50 border-orange-200 dark:border-orange-800',
          badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
          icon: <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
          circle: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
        }
      case 'sending':
        return {
          bg: 'dark:bg-yellow-950/30 bg-yellow-50 border-yellow-200 dark:border-yellow-800',
          badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
          icon: <Loader2 className="w-5 h-5 text-yellow-600 dark:text-yellow-400 animate-spin" />,
          circle: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
        }
      default:
        return {
          bg: 'dark:bg-gray-800/50 bg-gray-50 border-gray-200 dark:border-gray-700',
          badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
          icon: null,
          circle: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
        }
    }
  }

  const filteredContacts = getFilteredContacts()

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Professional Header */}
      <header className="header-gradient sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/10">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">WhatsApp Blaster</h1>
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1 text-xs font-medium ${isAuthenticated ? 'text-green-200' : 'text-white/70'}`}>
                    {isAuthenticated ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                        </span>
                        Connected
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3" />
                        Disconnected
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-3">
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all duration-200 hover:scale-105 border border-white/10"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              {/* Connection Button */}
              {isAuthenticated ? (
                <Button 
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 border border-white/20"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              ) : (
                <Button 
                  onClick={initializeWhatsApp}
                  disabled={isInitializing}
                  size="sm"
                  className="bg-white text-emerald-700 hover:bg-white/90 font-semibold shadow-lg"
                >
                  {isInitializing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4 mr-2" />
                  )}
                  Connect
                </Button>
              )}

              {/* Version Badge */}
              <Badge className="hidden sm:flex bg-white/20 text-white border-0 font-medium">
                <Zap className="w-3 h-3 mr-1" />
                v2.0 Pro
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Auth Section - Choose Method */}
        {!isAuthenticated && !qrCodeUrl && !isInitializing && !phoneLinkingStatus && (
          <Card className="mb-6 border-2 border-dashed border-primary/30 bg-card overflow-hidden animate-fadeIn">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/25 animate-bounce-subtle">
                  <MessageSquare className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Connect to WhatsApp</h3>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Choose your preferred method to connect WhatsApp Web for automatic message sending.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                {/* QR Code Option */}
                <Card 
                  className="border-2 border-primary/30 hover:border-primary hover:shadow-xl hover:shadow-primary/10 transition-all cursor-pointer group group/card"
                  onClick={initializeWhatsApp}
                >
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center group-hover/card:bg-primary/20 transition-colors">
                      <QrCode className="w-8 h-8 text-primary" />
                    </div>
                    <h4 className="font-semibold text-foreground mb-2 text-lg">Scan QR Code</h4>
                    <p className="text-sm text-muted-foreground">
                      Point your phone camera at the QR code to connect instantly
                    </p>
                  </CardContent>
                </Card>
                
                {/* Phone Number Option */}
                <Card className="border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xl transition-all">
                  <CardContent className="p-5 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                      <Smartphone className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h4 className="font-semibold text-foreground mb-3 text-lg">Link with Phone Number</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Get a code sent to your phone to link manually
                    </p>
                    <div className="flex gap-2 relative" ref={countryDropdownRef}>
                      {/* Country Code Dropdown - Enhanced with flags */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                          className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium border border-border rounded-l-lg bg-muted/50 hover:bg-muted focus:ring-2 focus:ring-primary/50 outline-none min-w-[100px] justify-between transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="text-lg">{COUNTRY_CODES.find(c => c.code === countryCode)?.flag || '🌐'}</span>
                            <span>{countryCode}</span>
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showCountryDropdown && (
                          <div className="absolute top-full left-0 mt-2 w-72 bg-popover border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-hidden animate-fadeIn">
                            <div className="p-3 border-b border-border">
                              <input
                                type="text"
                                placeholder="Search country..."
                                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                autoFocus
                              />
                            </div>
                            <div className="overflow-y-auto max-h-48">
                              {COUNTRY_CODES.map((country) => (
                                <button
                                  key={country.code}
                                  type="button"
                                  onClick={() => {
                                    setCountryCode(country.code)
                                    setShowCountryDropdown(false)
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent text-left transition-colors ${
                                    countryCode === country.code ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                                  }`}
                                >
                                  <span className="text-xl">{country.flag}</span>
                                  <span className="font-medium">{country.code}</span>
                                  <span className="text-muted-foreground ml-auto">{country.country}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <input
                        type="tel"
                        placeholder="Phone number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        onPaste={handlePhonePaste}
                        className="flex-1 px-4 py-2.5 text-sm border-t border-b border-r border-border rounded-r-lg bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && initializeWithPhone()}
                      />
                      <Button 
                        onClick={initializeWithPhone}
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap shadow-md"
                      >
                        Link
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
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
          <Card className="mb-6 border-primary/30 bg-card shadow-xl animate-fadeIn">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-primary flex items-center gap-2 text-xl">
                    <QrCode className="w-6 h-6" />
                    Scan QR Code with WhatsApp
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Open WhatsApp → Settings → Linked Devices → Link a Device
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button 
                    onClick={refreshQRCode}
                    variant="outline" 
                    size="sm"
                    className="border-primary/30 text-primary hover:bg-primary/10"
                    disabled={isInitializing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${isInitializing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button 
                    onClick={handleResetSession}
                    variant="outline" 
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    disabled={isInitializing}
                    title="Clear cached session data and generate a fresh QR code"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {/* Live sync pulse badge */}
              <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm font-medium text-primary shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                </span>
                <span>Live Sync • Token refreshes automatically</span>
              </div>

              <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-primary/30 mb-4 relative shadow-inner">
                <img 
                  src={qrCodeUrl} 
                  alt="WhatsApp QR Code" 
                  className="w-72 h-72 object-contain"
                />
              </div>
              
              {/* Instructions */}
              {qrInstructions.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl w-full max-w-md border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">How to scan:</p>
                  <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                    {qrInstructions.map((instruction, idx) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Note on QR Code Expiration */}
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl w-full max-w-md">
                <p className="font-semibold mb-1.5 flex items-center gap-2 text-amber-800 dark:text-amber-300 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Why do QR codes expire?
                </p>
                <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                  WhatsApp rotates security tokens every ~20 seconds. With Live Sync, we stream the latest active code so your scan connects instantly.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
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
                  className="text-muted-foreground hover:text-foreground"
                >
                  Try phone linking instead
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Phone Linking Status */}
        {phoneLinkingStatus && !isAuthenticated && (
          <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-card shadow-xl animate-fadeIn">
            <CardHeader className="pb-4">
              <CardTitle className="text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2">
                <Smartphone className="w-6 h-6" />
                Phone Number Linking
              </CardTitle>
              <CardDescription className="text-center">
                Follow the instructions on your phone to complete linking
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {phoneLinkScreenshot && (
                <div className="p-4 bg-muted rounded-xl border-2 border-dashed border-border mb-4 max-w-full overflow-hidden">
                  <img 
                    src={phoneLinkScreenshot} 
                    alt="Phone linking screen" 
                    className="max-w-full max-h-96 object-contain"
                  />
                </div>
              )}
              
              {qrInstructions.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl w-full max-w-md border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Next steps:</p>
                  <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                    {qrInstructions.map((instruction, idx) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ol>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
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
                className="mt-3 text-muted-foreground hover:text-foreground"
              >
                Try QR code instead
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Initializing Spinner */}
        {isInitializing && (
          <Card className="mb-6 border-border bg-card animate-fadeIn">
            <CardContent className="p-12 text-center">
              <Loader2 className="w-14 h-14 mx-auto mb-4 animate-spin text-primary" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {authMethod === 'phone' ? 'Linking your phone...' : 'Connecting to WhatsApp...'}
              </h3>
              <p className="text-muted-foreground">
                {authMethod === 'phone' 
                  ? 'Opening WhatsApp Web and initiating phone linking...' 
                  : 'Loading WhatsApp Web and generating QR code...'
                }
              </p>
              <p className="text-xs text-muted-foreground mt-3">This may take 10-30 seconds</p>
            </CardContent>
          </Card>
        )}

        {/* Auth Error */}
        {authError && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5 animate-fadeIn">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Connection Error</p>
                <p className="text-sm text-muted-foreground">{authError}</p>
              </div>
              <Button 
                onClick={initializeWhatsApp} 
                variant="outline" 
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column - Input Section */}
          <div className="space-y-6">
            {/* Message Input Card */}
            <Card className="border-border bg-card shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
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
                  className={`min-h-[140px] resize-none transition-all ${
                    isAuthenticated 
                      ? 'border-border focus:border-primary focus:ring-primary/20' 
                      : 'border-border bg-muted/50 cursor-not-allowed opacity-60'
                  }`}
                />
                
                {/* Character count */}
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>{message.length} characters</span>
                  <span>{message.split(/\s+/).filter(w => w.length > 0).length} words</span>
                </div>

                {/* File Upload Area */}
                <div 
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 ${
                    isAuthenticated 
                      ? 'border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 cursor-pointer' 
                      : 'border-border bg-muted/30 cursor-not-allowed opacity-60'
                  }`}
                >
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
                  <label htmlFor={isAuthenticated ? "file-upload" : ""} className={`cursor-${isAuthenticated ? 'pointer' : 'default'} block`}>
                    <Upload className={`w-10 h-10 mx-auto mb-2 ${isAuthenticated ? 'text-primary' : 'text-muted-foreground/50'}`} />
                    <p className={`text-sm font-medium ${isAuthenticated ? 'text-foreground' : 'text-muted-foreground'}`}>
                      Click to upload photos, videos, audio, or documents
                    </p>
                    <p className={`text-xs mt-1.5 ${isAuthenticated ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
                      Photos, Videos, Audio, PDF, DOC, TXT
                      {!isAuthenticated && ' (Connect WhatsApp first)'}
                    </p>
                  </label>
                </div>

                {/* Uploaded Files List */}
                {files.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-lg gap-3 border border-transparent hover:border-border transition-all group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                            {file.type === 'image' ? (
                              <ImageIcon className="w-4 h-4 text-blue-500" />
                            ) : file.type === 'video' ? (
                              <Video className="w-4 h-4 text-purple-500" />
                            ) : file.type === 'audio' ? (
                              <Music className="w-4 h-4 text-pink-500" />
                            ) : (
                              <FileText className="w-4 h-4 text-orange-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-foreground truncate block">{file.name}</span>
                            <span className="text-xs text-muted-foreground">{file.size}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <select
                            value={file.sendAs}
                            onChange={(e) => updateFileSendAs(file.id, e.target.value as UploadedFile['sendAs'])}
                            className="text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground font-medium focus:ring-2 focus:ring-primary/50 outline-none cursor-pointer shadow-sm"
                          >
                            {file.type === 'image' && (
                              <>
                                <option value="photo">📷 Photo</option>
                                <option value="document">📄 Document</option>
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
                              <option value="document">📄 Document</option>
                            )}
                          </select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Upload Card - NEW FEATURE */}
            <Card className="border-border bg-card shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <UserPlus className="w-4 h-4 text-blue-500" />
                      </div>
                      Import Contacts
                    </CardTitle>
                    <CardDescription>
                      Upload CSV or Excel file with contacts
                    </CardDescription>
                  </div>
                  {contacts.length > 0 && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                      {contacts.length} contacts
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`drop-zone ${isDraggingFile ? 'drop-zone-active' : ''}`}
                >
                  <input
                    ref={contactFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleContactFileUpload}
                    className="hidden"
                    id="contact-file-upload"
                  />
                  <label htmlFor="contact-file-upload" className="cursor-pointer block">
                    <FileSpreadsheet className={`w-10 h-10 mx-auto mb-2 ${isDraggingFile ? 'text-primary scale-110' : 'text-muted-foreground'} transition-transform`} />
                    <p className="text-sm font-medium text-foreground">
                      Drop your CSV or Excel file here
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports .csv, .xlsx, .xls • Columns: Name, Phone, Country (optional)
                    </p>
                  </label>
                </div>

                {/* Contacts List */}
                {contacts.length > 0 && (
                  <div className="space-y-3">
                    {/* Search and Actions */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Search contacts..."
                          value={contactSearchTerm}
                          onChange={(e) => setContactSearchTerm(e.target.value)}
                          className="input-professional pl-9"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={selectAllContacts}
                          className="text-xs"
                        >
                          Select All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={deselectAllContacts}
                          className="text-xs"
                        >
                          Deselect All
                        </Button>
                        <Button
                          size="sm"
                          onClick={addContactsToPhoneNumbers}
                          disabled={selectedContacts.size === 0}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add ({selectedContacts.size})
                        </Button>
                      </div>
                    </div>

                    {/* Contacts Table */}
                    <div className="border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="table-professional">
                        <thead className="sticky top-0">
                          <tr>
                            <th className="w-10">
                              <input
                                type="checkbox"
                                checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                                onChange={(e) => e.target.checked ? selectAllContacts() : deselectAllContacts()}
                                className="rounded border-border"
                              />
                            </th>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Country</th>
                            <th className="w-20">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredContacts.map((contact) => (
                            <tr key={contact.id} className={selectedContacts.has(contact.id) ? 'bg-primary/5' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedContacts.has(contact.id)}
                                  onChange={() => toggleSelectContact(contact.id)}
                                  className="rounded border-border"
                                />
                              </td>
                              <td>
                                {contact.isEditing ? (
                                  <input
                                    type="text"
                                    value={contact.name}
                                    onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="font-medium text-foreground">{contact.name}</span>
                                )}
                              </td>
                              <td>
                                {contact.isEditing ? (
                                  <input
                                    type="text"
                                    value={contact.phoneNumber}
                                    onChange={(e) => updateContact(contact.id, 'phoneNumber', e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background font-mono"
                                  />
                                ) : (
                                  <span className="font-mono text-sm text-foreground">{contact.countryCode}{contact.phoneNumber}</span>
                                )}
                              </td>
                              <td>
                                <span className="flex items-center gap-1.5">
                                  <span>{COUNTRY_CODES.find(c => c.code === contact.countryCode)?.flag || '🌐'}</span>
                                  <span className="text-xs text-muted-foreground">{contact.countryCode}</span>
                                </span>
                              </td>
                              <td>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => toggleEditContact(contact.id)}
                                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    title="Edit"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteContact(contact.id)}
                                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Delete"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Clear contacts button */}
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearContacts}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Clear All Contacts
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Phone Numbers Card */}
            <Card className="border-border bg-card shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-emerald-500" />
                  </div>
                  Recipient Numbers
                </CardTitle>
                <CardDescription>
                  Enter phone numbers or import from contacts above
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="+919876543210&#10;+14155551234&#10;+447911123456&#10;&#10;Or comma-separated: +919876543210, +14155551234"
                  value={phoneNumbers}
                  onChange={(e) => setPhoneNumbers(e.target.value)}
                  disabled={!isAuthenticated}
                  className={`min-h-[120px] resize-none font-mono text-sm transition-all ${
                    isAuthenticated 
                      ? 'border-border focus:border-primary focus:ring-primary/20' 
                      : 'border-border bg-muted/50 cursor-not-allowed opacity-60'
                  }`}
                />
                
                {/* Number stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span><strong className="text-foreground">{parsePhoneNumbers().length}</strong> valid numbers</span>
                  </div>
                  {phoneNumbers.split(/[\n,\s]+/).filter(n => n.trim()).length !== parsePhoneNumbers().length && (
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>Some invalid formats</span>
                    </div>
                  )}
                </div>

                {/* Speed Control */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Sending Speed
                    </label>
                    <Badge variant="secondary" className="text-xs font-mono">
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
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Fast (2s)</span>
                    <span>Slow (10s)</span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    Delays help avoid being blocked by WhatsApp
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Queue & Control Section */}
          <div className="space-y-6">
            {/* Control Panel */}
            <Card className="border-border bg-card shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Send className="w-4 h-4 text-purple-500" />
                  </div>
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
                    disabled={isSending || !isAuthenticated || (parsePhoneNumbers().length === 0 && contacts.length === 0)}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Build Queue
                  </Button>
                  <Button
                    onClick={processQueue}
                    disabled={isSending || queue.length === 0 || !isAuthenticated}
                    variant="outline"
                    className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary font-medium"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Auto Send
                  </Button>
                </div>

                {/* Progress Bar */}
                {(isSending || currentProgress > 0) && (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-bold text-primary">{Math.round(currentProgress)}%</span>
                    </div>
                    <div className="progress-animated">
                      <div style={{ width: `${currentProgress}%` }}></div>
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-2 mt-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50">
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
                    <div className="text-xs text-blue-600/80 dark:text-blue-500">Total</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-100 dark:border-green-900/50">
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.sent}</div>
                    <div className="text-xs text-green-600/80 dark:text-green-500">Sent ✓</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/50">
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
                    <div className="text-xs text-red-600/80 dark:text-red-500">Failed ✗</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-100 dark:border-orange-900/50">
                    <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats.notRegistered}</div>
                    <div className="text-xs text-orange-600/80 dark:text-orange-500">No WA</div>
                  </div>
                </div>

                {/* Pause/Stop Controls */}
                {isSending && (
                  <div className="flex gap-3">
                    <Button
                      onClick={togglePause}
                      variant="outline"
                      className="flex-1 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-medium"
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
                      className="flex-1 border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium"
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
                  className="w-full text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset All
                </Button>
              </CardContent>
            </Card>

            {/* Queue Preview */}
            <Card className="border-border bg-card shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-indigo-500" />
                    </div>
                    Message Queue
                  </CardTitle>
                  {queue.length > 0 && (
                    <Badge className="bg-primary/10 text-primary border-0 font-medium">
                      {queue.length} messages
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {queue.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-2xl flex items-center justify-center">
                      <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium">No messages in queue</p>
                    <p className="text-xs mt-1.5">
                      {isAuthenticated 
                        ? 'Build your queue to get started' 
                        : 'Connect WhatsApp first, then build your queue'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                    {queue.map((item, index) => {
                      const style = getStatusStyle(item.status)
                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${style.bg} animate-fadeIn`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${style.circle}`}>
                                {style.icon || (index + 1)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm text-foreground truncate">
                                  {item.phoneNumber}
                                </p>
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {item.message.substring(0, 60)}
                                  {item.message.length > 60 ? '...' : ''}
                                </p>
                                {item.files.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {item.files.length} file(s) attached
                                    </span>
                                  </div>
                                )}
                                {item.error && (
                                  <p className="text-xs text-destructive mt-2 flex items-center gap-1 bg-destructive/10 p-2 rounded-md">
                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {item.error}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs flex-shrink-0 font-medium ${style.badge}`}
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
        <Card className="mt-6 border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-foreground mb-2">How it works (v2.0 Pro):</p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span><strong className="text-foreground">Connect:</strong> Scan QR code to link your account</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span><strong className="text-foreground">Auto-Send:</strong> Messages are sent via browser automation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span><strong className="text-foreground">Import:</strong> Upload CSV/Excel with contacts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span><strong className="text-foreground">Rate Limits:</strong> Built-in delays prevent blocking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span><strong className="text-foreground">Tracking:</strong> Real-time status updates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Phone numbers must include country code (e.g., +91)</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-card/50 backdrop-blur-sm py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            WhatsApp Blaster v2.0 Pro • Professional Edition • Use responsibly
          </p>
        </div>
      </footer>
    </div>
  )
}
