import React, { useState, useEffect, useRef } from 'react'
import { Search, MapPin, Building2 } from 'lucide-react'
import { API_CONFIG } from '../config/environment'

interface Organization {
  id: string
  name: string
  city: string
  state: string
  country: string
  email: string
}

interface OrganizationAutocompleteProps {
  onSelect: (organization: Organization) => void
  placeholder?: string
  className?: string
}

const OrganizationAutocomplete: React.FC<OrganizationAutocompleteProps> = ({
  onSelect,
  placeholder = "Search for your organization...",
  className = ""
}) => {
  const [query, setQuery] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setOrganizations([])
      setShowDropdown(false)
      return
    }

    const timeoutId = setTimeout(() => {
      searchOrganizations(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchOrganizations = async (searchQuery: string) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/searchOrganizationsByName`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: searchQuery })
      })

      if (response.ok) {
        const result = await response.json()
        setOrganizations(result.organizations || [])
        setShowDropdown(true)
        setSelectedIndex(-1)
      } else {
        throw new Error('Failed to search organizations')
      }
    } catch (error) {
      console.error('Search error:', error)
      setError('Failed to search organizations. Please try again.')
      setOrganizations([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setError('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || organizations.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < organizations.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < organizations.length) {
          handleSelect(organizations[selectedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleSelect = (organization: Organization) => {
    setQuery(organization.name)
    setShowDropdown(false)
    setSelectedIndex(-1)
    onSelect(organization)
  }

  const formatLocation = (org: Organization) => {
    const parts = [org.city, org.state, org.country].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : 'Location not specified'
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && organizations.length > 0 && setShowDropdown(true)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-feline-500 focus:border-feline-500 sm:text-sm"
          placeholder={placeholder}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-feline-600"></div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {showDropdown && organizations.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
        >
          {organizations.map((org, index) => (
            <div
              key={org.id}
              className={`cursor-pointer select-none relative py-2 pl-3 pr-9 ${
                index === selectedIndex
                  ? 'bg-feline-600 text-white'
                  : 'text-gray-900 hover:bg-gray-100'
              }`}
              onClick={() => handleSelect(org)}
            >
              <div className="flex items-center">
                <Building2 className={`h-4 w-4 mr-2 ${
                  index === selectedIndex ? 'text-white' : 'text-gray-400'
                }`} />
                <div className="flex-1">
                  <div className={`font-medium ${
                    index === selectedIndex ? 'text-white' : 'text-gray-900'
                  }`}>
                    {org.name}
                  </div>
                  <div className={`flex items-center text-sm ${
                    index === selectedIndex ? 'text-feline-100' : 'text-gray-500'
                  }`}>
                    <MapPin className="h-3 w-3 mr-1" />
                    {formatLocation(org)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDropdown && query.length >= 2 && organizations.length === 0 && !isLoading && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-2 px-3 text-sm text-gray-500">
          No organizations found. Try a different search term or enter your RescueGroups ID below.
        </div>
      )}
    </div>
  )
}

export default OrganizationAutocomplete
