import React, { useState, useEffect, useRef } from 'react'
import { Search, User, ChevronDown } from 'lucide-react'

interface User {
  id: string
  name: string
  email?: string
}

interface UserSearchDropdownProps {
  value: string
  onChange: (userId: string, userName: string) => void
  placeholder?: string
  className?: string
}

const UserSearchDropdown: React.FC<UserSearchDropdownProps> = ({
  value,
  onChange,
  placeholder = "Search volunteers...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced search function
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setUsers([])
      return
    }

    setIsLoading(true)
    try {
      // Simulate API call - replace with actual Firebase call
      // For now, using mock data
      const mockUsers: User[] = [
        { id: 'user1', name: 'Sarah Johnson', email: 'sarah@example.com' },
        { id: 'user2', name: 'Mike Wilson', email: 'mike@example.com' },
        { id: 'user3', name: 'Tom Anderson', email: 'tom@example.com' },
        { id: 'user4', name: 'Lisa Garcia', email: 'lisa@example.com' },
        { id: 'user5', name: 'David Lee', email: 'david@example.com' },
        { id: 'user6', name: 'Jennifer Martinez', email: 'jennifer@example.com' },
        { id: 'user7', name: 'Michael Chen', email: 'michael@example.com' },
        { id: 'user8', name: 'Sarah Williams', email: 'sarah.w@example.com' },
        { id: 'user9', name: 'James Taylor', email: 'james@example.com' },
        { id: 'user10', name: 'Maria Rodriguez', email: 'maria@example.com' }
      ]

      // Filter users based on search query
      const filteredUsers = mockUsers.filter(user => 
        user.name.toLowerCase().includes(query.toLowerCase())
      )

      setUsers(filteredUsers)
    } catch (error) {
      console.error('Error searching users:', error)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle search input with debouncing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(query)
    }, 300)
  }

  // Handle user selection
  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setSearchQuery(user.name)
    onChange(user.id, user.name)
    setIsOpen(false)
  }

  // Handle free text input (when user types without selecting from dropdown)
  const handleFreeTextInput = () => {
    if (searchQuery.trim()) {
      // If there's text but no user selected, treat as free text
      setSelectedUser(null)
      onChange('', searchQuery.trim()) // Empty ID for free text
    } else {
      // If empty, clear everything
      setSelectedUser(null)
      onChange('', '')
    }
  }

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true)
    if (searchQuery && users.length === 0) {
      searchUsers(searchQuery)
    }
  }

  // Handle key press (Enter, Tab, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      setIsOpen(false)
      handleFreeTextInput()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      // Reset to selected user's name or clear if no selection
      if (selectedUser) {
        setSearchQuery(selectedUser.name)
      } else {
        setSearchQuery('')
        onChange('', '')
      }
    }
  }

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        // Handle free text input when clicking outside
        handleFreeTextInput()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [selectedUser, searchQuery])

  // Initialize selected user from value prop
  useEffect(() => {
    if (value && !selectedUser) {
      // If value is provided but no selectedUser, try to find it in users or set as display name
      const foundUser = users.find(user => user.id === value)
      if (foundUser) {
        setSelectedUser(foundUser)
        setSearchQuery(foundUser.name)
      } else {
        // If value is a name (for backward compatibility), set it as search query
        setSearchQuery(value)
      }
    }
  }, [value, selectedUser, users])

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-feline-500 focus:border-feline-500"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
        >
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500 text-center">
              Searching...
            </div>
          ) : (
            <>
              {/* Show free text option if there's a search query */}
              {searchQuery.trim() && (
                <button
                  onClick={() => {
                    setSelectedUser(null)
                    onChange('', searchQuery.trim())
                    setIsOpen(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center border-b border-gray-200"
                >
                  <Search className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      Use "{searchQuery.trim()}" as free text
                    </div>
                    <div className="text-xs text-gray-500">
                      Not in user database
                    </div>
                  </div>
                </button>
              )}
              
              {/* Show user search results */}
              {users.length > 0 ? (
                users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center"
                  >
                    <User className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {user.name}
                      </div>
                      {user.email && (
                        <div className="text-xs text-gray-500 truncate">
                          {user.email}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              ) : searchQuery ? (
                <div className="px-4 py-2 text-sm text-gray-500 text-center">
                  No users found matching "{searchQuery}"
                </div>
              ) : (
                <div className="px-4 py-2 text-sm text-gray-500 text-center">
                  Start typing to search users
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default UserSearchDropdown
