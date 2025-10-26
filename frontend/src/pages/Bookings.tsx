import React, { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Navigate } from 'react-router-dom'
import { 
  RotateCcw, 
  RefreshCw, 
  Download, 
  Check, 
  X, 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown,
  Calendar,
  User,
  Cat,
  Users,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Mail,
  Play,
  Heart,
  FileText,
  Save,
  FolderOpen
} from 'lucide-react'
import NotesEditor from '../components/NotesEditor'
import DocumentIcon from '../components/DocumentIcon'
import * as bookingsService from '../services/bookingsService'
import type { Booking } from '../services/bookingsService'
import { Timestamp } from 'firebase/firestore'

// Helper function to convert Timestamp to Date
const timestampToDate = (value: Date | Timestamp): Date => {
  if (value instanceof Timestamp) {
    return value.toDate()
  }
  return value
}

interface Cat {
  id: string
  name: string
  breed: string
  age: string
  sex: string
}

type SortDirection = 'asc' | 'desc' | null
type SortField = 'adopter' | 'startTs' | 'endTs' | 'volunteer' | 'adopterId' | 'catId' | 'calendarId' | 'groupId' | 'shelterId'

const Bookings: React.FC = () => {
  const { user } = useAuth()
  
  const formatDateTime = (date: Date | Timestamp): string => {
    const d = timestampToDate(date)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const year = d.getFullYear()
    const hours = d.getHours()
    const minutes = d.getMinutes()
    
    const ampm = hours >= 12 ? 'pm' : 'am'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    
    return `${month}/${day}/${year} ${displayHours}:${displayMinutes} ${ampm}`
  }

  // Get workflow order for status sorting
  const getStatusWorkflowOrder = (status: Booking['status']): number => {
    const workflowOrder = {
      'pending-shelter-setup': 1,
      'pending-confirmation': 2,
      'volunteer-assigned': 3,
      'confirmed': 4,
      'in-progress': 5,
      'completed': 6,
      'adopted': 7,
      'cancelled': 8
    }
    return workflowOrder[status] || 0
  }
  
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load bookings from backend on component mount
  useEffect(() => {
    loadBookings()
  }, [])

  const loadBookings = async () => {
    try {
      setLoading(true)
      setError(null)
      const fetchedBookings = await bookingsService.getBookings()
      setBookings(fetchedBookings)
    } catch (err: any) {
      console.error('Error loading bookings:', err)
      setError(err.message || 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }


  const [filters, setFilters] = useState({
    adopter: '',
    cat: '',
    dateFrom: '',
    dateTo: '',
    volunteer: '',
    status: '',
    statusGroup: '' as keyof typeof statusGroups | ''
  })

  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [notesEditorOpen, setNotesEditorOpen] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [workflowSortEnabled, setWorkflowSortEnabled] = useState(true)
  const [savedLayouts, setSavedLayouts] = useState<Record<string, any>>({})
  const [currentLayoutName, setCurrentLayoutName] = useState<string>('')
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false)
  const [layoutNameInput, setLayoutNameInput] = useState('')
  
  // Volunteer assignment modal
  const [isVolunteerModalOpen, setIsVolunteerModalOpen] = useState(false)
  const [selectedVolunteerBookingId, setSelectedVolunteerBookingId] = useState<string | null>(null)
  const [availableVolunteers, setAvailableVolunteers] = useState<any[]>([])
  
  // Reschedule modal
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false)
  const [selectedRescheduleBookingId, setSelectedRescheduleBookingId] = useState<string | null>(null)
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')

  // Load saved layouts from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('bookings-layouts')
    if (saved) {
      try {
        setSavedLayouts(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading saved layouts:', error)
      }
    }
  }, [])


  // Available options for dropdowns
  const statuses: Booking['status'][] = ['pending-shelter-setup', 'pending-confirmation', 'confirmed', 'volunteer-assigned', 'in-progress', 'completed', 'adopted', 'cancelled']

  // Status groups - sorted by workflow stage
  const statusGroups = {
    'early-stage': {
      label: 'Early Stage',
      statuses: ['pending-shelter-setup', 'pending-confirmation'] as Booking['status'][],
      color: 'bg-orange-100 text-orange-800'
    },
    'assigned': {
      label: 'Assigned',
      statuses: ['volunteer-assigned', 'confirmed'] as Booking['status'][],
      color: 'bg-blue-100 text-blue-800'
    },
    'active': {
      label: 'Active',
      statuses: ['in-progress'] as Booking['status'][],
      color: 'bg-purple-100 text-purple-800'
    },
    'finished': {
      label: 'Finished',
      statuses: ['completed', 'adopted', 'cancelled'] as Booking['status'][],
      color: 'bg-gray-100 text-gray-800'
    }
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Filter and sort bookings normally, then group adjacent bookings with same calendarId
  const filteredAndSortedBookings = useMemo(() => {
    // First, filter all bookings
    let filtered = bookings.filter(booking => {
      const bookingStartDate = timestampToDate(booking.startTs)
      const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null
      const toDate = filters.dateTo ? new Date(filters.dateTo) : null
      
      return (
        booking.adopter.toLowerCase().includes(filters.adopter.toLowerCase()) &&
        booking.cat.toLowerCase().includes(filters.cat.toLowerCase()) &&
        (!fromDate || bookingStartDate >= fromDate) &&
        (!toDate || bookingStartDate <= toDate) &&
        booking.volunteer.toLowerCase().includes(filters.volunteer.toLowerCase()) &&
        (filters.status === '' || booking.status === filters.status) &&
        (filters.statusGroup === '' || statusGroups[filters.statusGroup as keyof typeof statusGroups]?.statuses.includes(booking.status))
      )
    })

    // Sort bookings normally
    filtered.sort((a, b) => {
      // First, sort by workflow order if enabled
      if (workflowSortEnabled) {
        const aStatusOrder = getStatusWorkflowOrder(a.status)
        const bStatusOrder = getStatusWorkflowOrder(b.status)
        
        if (aStatusOrder !== bStatusOrder) {
          return aStatusOrder - bStatusOrder
        }
      }
      
      // If workflow sorting is disabled or statuses are the same, apply additional sorting if specified
      if (sortField && sortDirection) {
        let aVal = a[sortField]
        let bVal = b[sortField]
        
        if (sortField === 'startTs' || sortField === 'endTs') {
          aVal = new Date(aVal as Date).getTime().toString()
          bVal = new Date(bVal as Date).getTime().toString()
        } else if (sortField === 'adopterId' || sortField === 'catId' || sortField === 'calendarId' || sortField === 'groupId' || sortField === 'shelterId') {
          aVal = (aVal as number).toString()
          bVal = (bVal as number).toString()
        } else {
          aVal = (aVal as string).toLowerCase()
          bVal = (bVal as string).toLowerCase()
        }

        if (sortDirection === 'asc') {
          const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          if (result !== 0) return result
        } else {
          const result = aVal > bVal ? -1 : aVal < bVal ? 1 : 0
          if (result !== 0) return result
        }
      }
      
      // Final tiebreaker: sort by calendarId (group ID)
      return a.calendarId - b.calendarId
    })

    // Now group adjacent bookings with the same calendarId
    const grouped: { [key: number]: Booking[] } = {}
    let currentGroupId: number | null = null
    let groupCounter = 0

    filtered.forEach(booking => {
      // If this booking has a different calendarId than the previous one, start a new group
      if (currentGroupId !== booking.calendarId) {
        currentGroupId = booking.calendarId
        groupCounter++
      }
      
      // Use a unique group key that combines calendarId and group counter
      const groupKey = booking.calendarId * 1000 + groupCounter
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = []
      }
      grouped[groupKey].push(booking)
    })

    return grouped
  }, [bookings, filters, sortField, sortDirection, workflowSortEnabled])

  // Pagination logic - flatten grouped bookings for counting
  const allFilteredBookings = useMemo(() => {
    const flat: Booking[] = []
    Object.values(filteredAndSortedBookings).forEach(group => {
      flat.push(...group)
    })
    return flat
  }, [filteredAndSortedBookings])

  const totalItems = allFilteredBookings.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize

  // Get paginated groups
  const paginatedGroups = useMemo(() => {
    const flat: Booking[] = []
    Object.values(filteredAndSortedBookings).forEach(group => {
      flat.push(...group)
    })
    
    const paginatedBookings = flat.slice(startIndex, endIndex)
    
    // Group the paginated bookings
    const grouped: { [key: number]: Booking[] } = {}
    let currentGroupId: number | null = null
    let groupCounter = 0

    paginatedBookings.forEach(booking => {
      if (currentGroupId !== booking.calendarId) {
        currentGroupId = booking.calendarId
        groupCounter++
      }
      
      const groupKey = booking.calendarId * 1000 + groupCounter
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = []
      }
      grouped[groupKey].push(booking)
    })

    return grouped
  }, [filteredAndSortedBookings, startIndex, endIndex])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortDirection(null)
        setSortField(null)
      } else {
        setSortDirection('asc')
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-4 h-4 text-gray-400" />
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="w-4 h-4 text-feline-600" />
    }
    if (sortDirection === 'desc') {
      return <ChevronDown className="w-4 h-4 text-feline-600" />
    }
    return <ChevronsUpDown className="w-4 h-4 text-gray-400" />
  }


  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value }
      
      // If selecting a specific status, reset status group to "All"
      if (field === 'status' && value !== '') {
        newFilters.statusGroup = ''
      }
      
      // If selecting a status group, reset status dropdown to "All"
      if (field === 'statusGroup' && value !== '') {
        newFilters.status = ''
      }
      
      return newFilters
    })
  }

  const resetFilters = () => {
    setFilters({
      adopter: '',
      cat: '',
      dateFrom: '',
      dateTo: '',
      volunteer: '',
      status: '',
      statusGroup: ''
    })
    setCurrentPage(1) // Reset to first page when filters are cleared
  }

  const refreshData = () => {
    loadBookings()
  }

  const downloadData = () => {
    const csvContent = [
      ['Adopter', 'Cat', 'Start Time', 'End Time', 'Volunteer', 'Status'],
      ...allFilteredBookings.map(booking => [
        booking.adopter,
        booking.cat,
        formatDateTime(booking.startTs),
        formatDateTime(booking.endTs),
        booking.volunteer,
        booking.status
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Layout management functions
  const saveCurrentLayout = () => {
    setIsLayoutModalOpen(true)
    setLayoutNameInput('')
  }

  const handleSaveLayout = () => {
    if (!layoutNameInput.trim()) return

    const layoutData = {
      filters,
      sortField,
      sortDirection,
      pageSize,
      workflowSortEnabled,
      savedAt: new Date().toISOString()
    }

    const newSavedLayouts = {
      ...savedLayouts,
      [layoutNameInput.trim()]: layoutData
    }

    setSavedLayouts(newSavedLayouts)
    localStorage.setItem('bookings-layouts', JSON.stringify(newSavedLayouts))
    setCurrentLayoutName(layoutNameInput.trim())
    setIsLayoutModalOpen(false)
    setLayoutNameInput('')
    
    // Show success message (you could add a toast notification here)
    console.log(`Layout "${layoutNameInput.trim()}" saved successfully!`)
  }

  const loadLayout = (layoutName: string) => {
    const layout = savedLayouts[layoutName]
    if (layout) {
      setFilters(layout.filters)
      setSortField(layout.sortField)
      setSortDirection(layout.sortDirection)
      setPageSize(layout.pageSize)
      setWorkflowSortEnabled(layout.workflowSortEnabled)
      setCurrentPage(1) // Reset to first page
      setCurrentLayoutName(layoutName)
      
      console.log(`Layout "${layoutName}" loaded successfully!`)
    }
  }

  const getLayoutNames = () => {
    return Object.keys(savedLayouts).sort()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1) // Reset to first page when page size changes
  }

  const handleNotesClick = (bookingId: string) => {
    setSelectedBookingId(bookingId)
    setNotesEditorOpen(true)
  }

  const handleSaveNotes = async (bookingId: string, notes: string) => {
    try {
      await bookingsService.updateBookingNotes(bookingId, notes)
      
      // Update local state
      setBookings(prev => prev.map(booking => 
        booking.id === bookingId ? { ...booking, notes } : booking
      ))
      
      console.log(`Saved notes for booking ${bookingId}`)
    } catch (error: any) {
      console.error('Error saving notes:', error)
      setError(error.message || 'Failed to save notes')
    }
  }

  const handleCloseNotesEditor = () => {
    setNotesEditorOpen(false)
    setSelectedBookingId(null)
  }

  const generatePageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      const startPage = Math.max(1, currentPage - 2)
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
      
      if (startPage > 1) {
        pages.push(1)
        if (startPage > 2) {
          pages.push('...')
        }
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push('...')
        }
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  const getStatusLabel = (status: Booking['status']) => {
    switch (status) {
      case 'pending-shelter-setup':
        return 'Pending Shelter Setup'
      case 'pending-confirmation':
        return 'Pending Confirmation'
      case 'confirmed':
        return 'Confirmed'
      case 'volunteer-assigned':
        return 'Volunteer Assigned'
      case 'in-progress':
        return 'In Progress'
      case 'completed':
        return 'Completed'
      case 'adopted':
        return 'Adopted'
      case 'cancelled':
        return 'Cancelled'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'pending-shelter-setup':
        return 'bg-orange-100 text-orange-800'
      case 'pending-confirmation':
        return 'bg-yellow-100 text-yellow-800'
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'volunteer-assigned':
        return 'bg-blue-100 text-blue-800'
      case 'in-progress':
        return 'bg-purple-100 text-purple-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'adopted':
        return 'bg-green-200 text-green-900'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: Booking['status']) => {
    switch (status) {
      case 'pending-shelter-setup':
        return <Clock className="w-4 h-4" />
      case 'pending-confirmation':
        return <Clock className="w-4 h-4" />
      case 'confirmed':
        return <Check className="w-4 h-4" />
      case 'volunteer-assigned':
        return <User className="w-4 h-4" />
      case 'in-progress':
        return <Clock className="w-4 h-4" />
      case 'completed':
        return <Check className="w-4 h-4" />
      case 'adopted':
        return <span className="text-lg">❤️</span>
      case 'cancelled':
        return <X className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  // Get stage-specific notes tooltip
  const getStageNotesTooltip = (status: Booking['status']) => {
    switch (status) {
      case 'pending-shelter-setup':
        return 'Add setup and configuration notes'
      case 'pending-confirmation':
        return 'Add communication and confirmation notes'
      case 'volunteer-assigned':
        return 'Add volunteer assignment and coordination notes'
      case 'confirmed':
        return 'Add visit preparation and confirmation notes'
      case 'in-progress':
        return 'Add visit progress and interaction notes'
      case 'completed':
        return 'Add visit completion and follow-up notes'
      case 'adopted':
        return 'Add adoption and congratulations notes'
      case 'cancelled':
        return 'Add cancellation and general notes'
      default:
        return 'Add notes'
    }
  }

  // Get action buttons for each status
  const getStatusActions = (booking: Booking) => {
    const actions: Array<{ icon: any; label: string; color: string; action: string }> = []
    
    switch (booking.status) {
      case 'pending-shelter-setup':
        actions.push(
          { icon: Mail, label: 'Send Setup Email', color: 'text-blue-600 hover:text-blue-800', action: 'send-email' },
          { icon: Calendar, label: 'Reschedule', color: 'text-orange-600 hover:text-orange-800', action: 'reschedule' },
          { icon: Check, label: 'Confirm Setup', color: 'text-green-600 hover:text-green-800', action: 'confirm-setup' }
        )
        break
      case 'pending-confirmation':
        actions.push(
          { icon: Mail, label: 'Resend Email', color: 'text-blue-600 hover:text-blue-800', action: 'resend-email' },
          { icon: Calendar, label: 'Reschedule', color: 'text-orange-600 hover:text-orange-800', action: 'reschedule' },
          { icon: User, label: 'Assign Volunteer', color: 'text-purple-600 hover:text-purple-800', action: 'assign-volunteer' },
          { icon: Check, label: 'Confirm Appointment', color: 'text-green-600 hover:text-green-800', action: 'confirm' },
          { icon: X, label: 'Cancel', color: 'text-red-600 hover:text-red-800', action: 'cancel' }
        )
        break
      case 'volunteer-assigned':
        actions.push(
          { icon: Calendar, label: 'Reschedule', color: 'text-orange-600 hover:text-orange-800', action: 'reschedule' },
          { icon: User, label: 'Reassign Volunteer', color: 'text-purple-600 hover:text-purple-800', action: 'reassign-volunteer' },
          { icon: Check, label: 'Confirm Appointment', color: 'text-green-600 hover:text-green-800', action: 'confirm' },
          { icon: X, label: 'Cancel', color: 'text-red-600 hover:text-red-800', action: 'cancel' }
        )
        break
      case 'confirmed':
        actions.push(
          { icon: Calendar, label: 'Reschedule', color: 'text-orange-600 hover:text-orange-800', action: 'reschedule' },
          { icon: User, label: 'Reassign Volunteer', color: 'text-purple-600 hover:text-purple-800', action: 'reassign-volunteer' },
          { icon: Play, label: 'Start Visit', color: 'text-blue-600 hover:text-blue-800', action: 'start-visit' },
          { icon: X, label: 'Cancel', color: 'text-red-600 hover:text-red-800', action: 'cancel' }
        )
        break
      case 'in-progress':
        actions.push(
          { icon: User, label: 'Reassign Volunteer', color: 'text-purple-600 hover:text-purple-800', action: 'reassign-volunteer' },
          { icon: Check, label: 'Complete Visit', color: 'text-green-600 hover:text-green-800', action: 'complete-visit' },
          { icon: Heart, label: 'Mark as Adopted', color: 'text-pink-600 hover:text-pink-800', action: 'mark-adopted' },
          { icon: X, label: 'Cancel', color: 'text-red-600 hover:text-red-800', action: 'cancel' }
        )
        break
      case 'completed':
        actions.push(
          { icon: Heart, label: 'Mark as Adopted', color: 'text-pink-600 hover:text-pink-800', action: 'mark-adopted' },
          { icon: FileText, label: 'Add Follow-up Notes', color: 'text-gray-600 hover:text-gray-800', action: 'add-notes' }
        )
        break
      case 'adopted':
        actions.push(
          { icon: FileText, label: 'Add Follow-up Notes', color: 'text-gray-600 hover:text-gray-800', action: 'add-notes' },
          { icon: Mail, label: 'Send Congratulations', color: 'text-blue-600 hover:text-blue-800', action: 'send-congrats' }
        )
        break
      case 'cancelled':
        actions.push(
          { icon: RotateCcw, label: 'Reactivate', color: 'text-green-600 hover:text-green-800', action: 'reactivate' },
          { icon: FileText, label: 'Add Notes', color: 'text-gray-600 hover:text-gray-800', action: 'add-notes' }
        )
        break
    }
    
    return actions
  }

  // Handle action button clicks
  const handleActionClick = async (booking: Booking, action: string) => {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions')
      const functions = getFunctions()
      
      let newStatus: Booking['status'] | null = null

      switch (action) {
        case 'send-email':
          // Send setup email
          const sendEmail = httpsCallable(functions, 'sendBookingEmail')
          await sendEmail({ 
            bookingId: booking.id, 
            emailType: 'setup' 
          })
          console.log(`Sent setup email for booking ${booking.id}`)
          break
          
        case 'resend-email':
          // Resend confirmation email
          const resendEmail = httpsCallable(functions, 'sendBookingEmail')
          await resendEmail({ 
            bookingId: booking.id, 
            emailType: 'confirmation' 
          })
          console.log(`Resent confirmation email for booking ${booking.id}`)
          break
          
        case 'reschedule':
          // Open reschedule modal
          setSelectedRescheduleBookingId(booking.id)
          setIsRescheduleModalOpen(true)
          break
          
        case 'confirm-setup':
          newStatus = 'pending-confirmation'
          break
          
        case 'confirm':
          newStatus = 'confirmed'
          // Sync to calendar when confirmed
          try {
            const syncCalendar = httpsCallable(functions, 'syncBookingToCalendar')
            await syncCalendar({ bookingId: booking.id, action: 'update' })
            console.log('Synced to calendar')
          } catch (err) {
            console.error('Calendar sync failed:', err)
          }
          break
          
        case 'assign-volunteer':
        case 'reassign-volunteer':
          // TODO: Load available volunteers from organization
          setSelectedVolunteerBookingId(booking.id)
          setIsVolunteerModalOpen(true)
          break
          
        case 'start-visit':
          newStatus = 'in-progress'
          break
          
        case 'complete-visit':
          newStatus = 'completed'
          break
          
        case 'mark-adopted':
          newStatus = 'adopted'
          // Send congratulations email
          try {
            const sendCongrats = httpsCallable(functions, 'sendBookingEmail')
            await sendCongrats({ 
              bookingId: booking.id, 
              emailType: 'congratulations' 
            })
          } catch (err) {
            console.error('Failed to send congratulations email:', err)
          }
          break
          
        case 'cancel':
          newStatus = 'cancelled'
          // Delete calendar event
          try {
            const syncCalendar = httpsCallable(functions, 'syncBookingToCalendar')
            await syncCalendar({ bookingId: booking.id, action: 'delete' })
            console.log('Deleted calendar event')
          } catch (err) {
            console.error('Calendar delete failed:', err)
          }
          break
          
        case 'reactivate':
          newStatus = 'pending-confirmation'
          break
          
        case 'add-notes':
          handleNotesClick(booking.id!)
          break
          
        case 'send-congrats':
          try {
            const sendCongrats = httpsCallable(functions, 'sendBookingEmail')
            await sendCongrats({ 
              bookingId: booking.id, 
              emailType: 'congratulations' 
            })
            console.log('Sent congratulations email')
          } catch (err) {
            console.error('Failed to send congratulations email:', err)
          }
          break
      }

      // If we need to update the status, do it via backend
      if (newStatus && booking.id) {
        await bookingsService.updateBooking(booking.id, { status: newStatus })
        
        // Update local state
        setBookings(prev => prev.map(b => 
          b.id === booking.id ? { ...b, status: newStatus! } : b
        ))
        
        console.log(`Updated booking ${booking.id} status to ${newStatus}`)
      }
    } catch (error: any) {
      console.error('Error handling action:', error)
      setError(error.message || 'Failed to update booking')
    }
  }

  return (
    <div className="py-8 max-w-7xl mx-auto px-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage adoption appointments and meet & greets
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-feline-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading bookings</h3>
              <p className="mt-2 text-sm text-red-700">{error}</p>
              <button
                onClick={refreshData}
                className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>

      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={refreshData}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={resetFilters}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            title="Reset Filters"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </button>
          <button
            onClick={downloadData}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            title="Download Filtered Data"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </button>
          <button
            onClick={saveCurrentLayout}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            title="Save Current Layout"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Layout
          </button>
          <div className="relative">
            <select
              value={currentLayoutName}
              onChange={(e) => {
                if (e.target.value) {
                  loadLayout(e.target.value)
                } else {
                  setCurrentLayoutName('')
                }
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-feline-500 focus:border-feline-500"
              title="Load Saved Layout"
            >
              <option value="">Load Layout</option>
              {getLayoutNames().map(layoutName => (
                <option key={layoutName} value={layoutName}>
                  {layoutName}
                </option>
              ))}
            </select>
            <FolderOpen className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} bookings
          {currentLayoutName && (
            <span className="ml-2 text-feline-600 font-medium">
              • {currentLayoutName}
            </span>
          )}
        </div>
      </div>

      {/* Status Group Filter Bar */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Filter by Status Group:</span>
          <div className="flex space-x-2">
            <button
              onClick={() => handleFilterChange('statusGroup', '')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filters.statusGroup === ''
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {Object.entries(statusGroups).map(([key, group], index) => (
              <React.Fragment key={key}>
                <button
                  onClick={() => handleFilterChange('statusGroup', key)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filters.statusGroup === key
                      ? group.color
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {group.label}
                </button>
                {index < Object.entries(statusGroups).length - 1 && (
                  <div className="w-px h-6 bg-gray-300"></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('adopter')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Adopter
                    </div>
                    {getSortIcon('adopter')}
                  </div>
                </th>
                <th className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <Cat className="w-4 h-4 mr-2" />
                    Cat
                  </div>
                </th>
                <th 
                  className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('startTs')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Start Time
                    </div>
                    {getSortIcon('startTs')}
                  </div>
                </th>
                <th 
                  className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('endTs')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      End Time
                    </div>
                    {getSortIcon('endTs')}
                  </div>
                </th>
                <th 
                  className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('volunteer')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      Volunteer
                    </div>
                    {getSortIcon('volunteer')}
                  </div>
                </th>
                <th className="w-3/16 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex flex-col items-center">
                    <span>Status</span>
                    <div className="flex items-center mt-1">
                      <input
                        type="checkbox"
                        checked={workflowSortEnabled}
                        onChange={(e) => setWorkflowSortEnabled(e.target.checked)}
                        className="w-3 h-3 text-feline-600 border-gray-300 rounded focus:ring-feline-500"
                      />
                      <span className="text-xs text-gray-400 font-normal ml-1">by Stage</span>
                    </div>
                  </div>
                </th>
                <th className="w-4/16 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-center">
                    <Play className="w-4 h-4 mr-1" />
                  Actions
                  </div>
                </th>
              </tr>
            </thead>
            <thead className="bg-gray-100">
              <tr>
                {/* Filter Row */}
                <th className="w-1/8 px-6 py-2">
                  <input
                    type="text"
                    placeholder="Filter adopter..."
                    value={filters.adopter}
                    onChange={(e) => handleFilterChange('adopter', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                  />
                </th>
                <th className="w-1/8 px-6 py-2">
                  <input
                    type="text"
                    placeholder="Filter cat..."
                    value={filters.cat}
                    onChange={(e) => handleFilterChange('cat', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                  />
                </th>
                <th className="w-1/8 px-6 py-2">
                      <input
                    type="text"
                    placeholder="Filter start time..."
                        value={filters.dateFrom}
                        onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                      />
                </th>
                <th className="w-1/8 px-6 py-2">
                      <input
                    type="text"
                    placeholder="Filter end time..."
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                      />
                </th>
                <th className="w-1/8 px-6 py-2">
                  <input
                    type="text"
                    placeholder="Filter volunteer..."
                    value={filters.volunteer}
                    onChange={(e) => handleFilterChange('volunteer', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                  />
                </th>
                <th className="w-3/16 px-6 py-2">
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                  >
                    <option value="">All Statuses</option>
                    {statuses.map(status => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="w-4/16 px-6 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(paginatedGroups).map(([calendarIdStr, groupBookings]) => {
                const calendarId = parseInt(calendarIdStr)
                const isGrouped = groupBookings.length > 1
                const summary = groupBookings[0]?.summary || ''
                
                return (
                  <React.Fragment key={calendarId}>
                    {/* Group Summary Row (only for groups with multiple bookings) */}
                    {isGrouped && (
                      <tr>
                        <td colSpan={7} className="px-6 py-2">
                      <div className="relative">
                            <div className="absolute top-0 left-0 z-10">
                              <span className="inline-block bg-white px-2 py-1 text-xs text-gray-600 font-medium rounded border border-gray-300">
                                {summary}
                              </span>
                            </div>
                            <div className="border-2 border-gray-300 rounded-lg mt-2"></div>
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {/* Individual Booking Rows */}
                    {groupBookings.map((booking) => (
                      <tr key={booking.id} className={`hover:bg-gray-50 ${isGrouped ? 'relative' : ''}`}>
                        {isGrouped && (
                          <td colSpan={7} className="px-6 py-0">
                            <div className="border-l-2 border-gray-300 ml-4 pl-4">
                              <div className="flex">
                                <div className="w-1/8 px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm font-medium text-gray-900">{booking.adopter}</span>
                                </div>
                                <div className="w-1/8 px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm text-gray-900">{booking.cat}</span>
                                </div>
                                <div className="w-1/8 px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {formatDateTime(booking.startTs)}
                                  </div>
                                </div>
                                <div className="w-1/8 px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {formatDateTime(booking.endTs)}
                                  </div>
                                </div>
                                <div className="w-1/8 px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm text-gray-900">{booking.volunteer}</span>
                                </div>
                                <div className="w-3/16 px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                                    {getStatusIcon(booking.status)}
                                    <span className="ml-1">{getStatusLabel(booking.status)}</span>
                                  </span>
                                </div>
                                <div className="w-4/16 px-6 py-4 whitespace-nowrap text-center">
                                  {/* Notes Icon + Action Buttons */}
                                  <div className="flex items-center justify-center space-x-0.5">
                                    {/* Notes Icon - First */}
                                    <button
                                      onClick={() => booking.id && handleNotesClick(booking.id)}
                                      className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 transition-colors"
                                      title={getStageNotesTooltip(booking.status)}
                                    >
                                      <DocumentIcon 
                                        hasNotes={!!booking.notes}
                                        className="w-4 h-4" 
                                      />
                                    </button>
                                    
                                    {/* Action Buttons */}
                                    {getStatusActions(booking).map((actionItem, actionIndex) => {
                                      const IconComponent = actionItem.icon
                                      return (
                                        <button
                                          key={actionIndex}
                                          onClick={() => handleActionClick(booking, actionItem.action)}
                                          className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${actionItem.color}`}
                                          title={actionItem.label}
                                        >
                                          <IconComponent className="w-4 h-4" />
                                        </button>
                                      )
                                    })}
                              </div>
                          </div>
                          </div>
                      </div>
                  </td>
                        )}
                        
                        {!isGrouped && (
                          <>
                            <td className="w-1/8 px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">{booking.adopter}</span>
                  </td>
                            <td className="w-1/8 px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900">{booking.cat}</span>
                            </td>
                            <td className="w-1/8 px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDateTime(booking.startTs)}
                              </div>
                            </td>
                            <td className="w-1/8 px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDateTime(booking.endTs)}
                              </div>
                            </td>
                            <td className="w-1/8 px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{booking.volunteer}</span>
                  </td>
                            <td className="w-3/16 px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {getStatusIcon(booking.status)}
                                <span className="ml-1">{getStatusLabel(booking.status)}</span>
                      </span>
                  </td>
                            <td className="w-4/16 px-6 py-4 whitespace-nowrap text-center">
                              {/* Notes Icon + Action Buttons */}
                              <div className="flex items-center justify-center space-x-0.5">
                                {/* Notes Icon - First */}
                        <button
                                  onClick={() => booking.id && handleNotesClick(booking.id)}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 transition-colors"
                                  title={getStageNotesTooltip(booking.status)}
                                >
                                  <DocumentIcon 
                                    hasNotes={!!booking.notes}
                                    className="w-4 h-4" 
                                  />
                                </button>
                                
                                {/* Action Buttons */}
                                {getStatusActions(booking).map((actionItem, actionIndex) => {
                                  const IconComponent = actionItem.icon
                                  return (
                        <button
                                      key={actionIndex}
                                      onClick={() => handleActionClick(booking, actionItem.action)}
                                      className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${actionItem.color}`}
                                      title={actionItem.label}
                                    >
                                      <IconComponent className="w-4 h-4" />
                        </button>
                                  )
                                })}
                      </div>
                  </td>
                          </>
                        )}
                </tr>
              ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {allFilteredBookings.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No bookings found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your filters or add some bookings.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">Show</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-feline-500 focus:border-feline-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-700">per page</span>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {totalPages === 1 ? (
                  <button
                    disabled
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 cursor-default"
                  >
                    1
                  </button>
                ) : (
                  generatePageNumbers().map((page, index) => (
                    <button
                      key={index}
                      onClick={() => typeof page === 'number' ? handlePageChange(page) : undefined}
                      disabled={page === '...'}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === currentPage
                          ? 'z-10 bg-feline-50 border-feline-500 text-feline-600'
                          : page === '...'
                          ? 'border-gray-300 bg-white text-gray-700 cursor-default'
                          : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))
                )}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Notes Editor Modal */}
      <NotesEditor
        bookingId={selectedBookingId || ''}
        initialNotes={selectedBookingId ? bookings.find(b => b.id === selectedBookingId)?.notes || '' : ''}
        isOpen={notesEditorOpen}
        onClose={handleCloseNotesEditor}
        onSave={handleSaveNotes}
      />

      {/* Layout Name Input Modal */}
      {isLayoutModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Save Current Layout</h3>
              <div className="mb-4">
                <label htmlFor="layoutName" className="block text-sm font-medium text-gray-700 mb-2">
                  Layout Name
                </label>
                <input
                  type="text"
                  id="layoutName"
                  value={layoutNameInput}
                  onChange={(e) => setLayoutNameInput(e.target.value)}
                  placeholder="Enter layout name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveLayout()
                    } else if (e.key === 'Escape') {
                      setIsLayoutModalOpen(false)
                      setLayoutNameInput('')
                    }
                  }}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsLayoutModalOpen(false)
                    setLayoutNameInput('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLayout}
                  disabled={!layoutNameInput.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-feline-600 border border-transparent rounded-md hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-feline-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Layout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Volunteer Assignment Modal */}
      {isVolunteerModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Assign Volunteer</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select a Volunteer
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                  defaultValue=""
                >
                  <option value="">-- Select Volunteer --</option>
                  {/* TODO: Load volunteers from organization */}
                  <option value="volunteer1">John Doe</option>
                  <option value="volunteer2">Jane Smith</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsVolunteerModalOpen(false)
                    setSelectedVolunteerBookingId(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    // TODO: Implement volunteer assignment
                    const { getFunctions, httpsCallable } = await import('firebase/functions')
                    const functions = getFunctions()
                    const assignVolunteer = httpsCallable(functions, 'assignVolunteerToBooking')
                    // await assignVolunteer({ bookingId: selectedVolunteerBookingId, ... })
                    console.log('Assign volunteer to', selectedVolunteerBookingId)
                    setIsVolunteerModalOpen(false)
                    setSelectedVolunteerBookingId(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-feline-600 rounded-md hover:bg-feline-700"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {isRescheduleModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Reschedule Appointment</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsRescheduleModalOpen(false)
                    setSelectedRescheduleBookingId(null)
                    setNewStartDate('')
                    setNewEndDate('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const { getFunctions, httpsCallable } = await import('firebase/functions')
                    const functions = getFunctions()
                    const reschedule = httpsCallable(functions, 'rescheduleBooking')
                    await reschedule({
                      bookingId: selectedRescheduleBookingId,
                      newStartTs: newStartDate,
                      newEndTs: newEndDate
                    })
                    console.log('Rescheduled to', newStartDate, '-', newEndDate)
                    setIsRescheduleModalOpen(false)
                    setSelectedRescheduleBookingId(null)
                    setNewStartDate('')
                    setNewEndDate('')
                    loadBookings() // Refresh bookings
                  }}
                  disabled={!newStartDate || !newEndDate}
                  className="px-4 py-2 text-sm font-medium text-white bg-feline-600 rounded-md hover:bg-feline-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reschedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

export default Bookings