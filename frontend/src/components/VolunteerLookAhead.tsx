import React, { useState, useEffect, useRef } from 'react'
import { Search, User, Plus } from 'lucide-react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../services/auth'

interface Volunteer {
  id: string
  name: string
  email: string
}

interface VolunteerLookAheadProps {
  onAdd: (volunteer: Volunteer) => void
  excludeIds?: string[]
  className?: string
}

const VolunteerLookAhead: React.FC<VolunteerLookAheadProps> = ({
  onAdd,
  excludeIds = [],
  className = ""
}) => {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Search volunteers
  useEffect(() => {
    if (!searchQuery.trim() || !user) {
      setVolunteers([])
      setIsOpen(false)
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsLoading(true)
      try {
        // Get user's orgId
        const userDocRef = doc(db, 'team', user.uid)
        const userDocSnap = await getDoc(userDocRef)
        
        if (!userDocSnap.exists()) {
          setVolunteers([])
          return
        }

        const userData = userDocSnap.data()
        const orgId = userData?.orgId

        if (!orgId) {
          setVolunteers([])
          return
        }

        // Search team members in same organization
        const teamQuery = query(
          collection(db, 'team'),
          where('orgId', '==', orgId)
        )

        const teamSnapshot = await getDocs(teamQuery)
        const allVolunteers: Volunteer[] = []

        teamSnapshot.docs.forEach(doc => {
          const data = doc.data()
          const volunteer: Volunteer = {
            id: doc.id,
            name: data.name || data.displayName || data.email || 'Unknown',
            email: data.email || ''
          }

          // Filter by search query
          const matchesQuery = volunteer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            volunteer.email.toLowerCase().includes(searchQuery.toLowerCase())

          // Exclude already added volunteers
          const notExcluded = !excludeIds.includes(volunteer.id)

          if (matchesQuery && notExcluded) {
            allVolunteers.push(volunteer)
          }
        })

        setVolunteers(allVolunteers)
        setIsOpen(allVolunteers.length > 0)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Error searching volunteers:', error)
        setVolunteers([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [searchQuery, user, excludeIds])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (volunteer: Volunteer) => {
    onAdd(volunteer)
    setSearchQuery('')
    setIsOpen(false)
    setVolunteers([])
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || volunteers.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < volunteers.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < volunteers.length) {
          handleSelect(volunteers[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (volunteers.length > 0) {
              setIsOpen(true)
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search volunteers..."
          className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-md focus:ring-feline-500 focus:border-feline-500"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-feline-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {isOpen && volunteers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none"
        >
          {volunteers.map((volunteer, index) => (
            <div
              key={volunteer.id}
              className={`cursor-pointer select-none relative py-2 pl-3 pr-9 ${
                index === selectedIndex
                  ? 'bg-feline-600 text-white'
                  : 'text-gray-900 hover:bg-gray-100'
              }`}
              onClick={() => handleSelect(volunteer)}
            >
              <div className="flex items-center">
                <User className={`h-4 w-4 mr-2 ${
                  index === selectedIndex ? 'text-white' : 'text-gray-400'
                }`} />
                <div className="flex-1">
                  <div className={`font-medium ${
                    index === selectedIndex ? 'text-white' : 'text-gray-900'
                  }`}>
                    {volunteer.name}
                  </div>
                  {volunteer.email && (
                    <div className={`text-sm ${
                      index === selectedIndex ? 'text-feline-100' : 'text-gray-500'
                    }`}>
                      {volunteer.email}
                    </div>
                  )}
                </div>
                <Plus className={`h-4 w-4 mr-2 ${
                  index === selectedIndex ? 'text-white' : 'text-gray-400'
                }`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && searchQuery.length > 0 && volunteers.length === 0 && !isLoading && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-md py-2 px-3 text-sm text-gray-500">
          No volunteers found
        </div>
      )}
    </div>
  )
}

export default VolunteerLookAhead

