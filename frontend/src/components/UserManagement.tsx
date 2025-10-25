import React, { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, getDoc, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../services/auth'
import { Plus, Edit, Trash2, Save, X, Search } from 'lucide-react'

interface User {
  id: string
  email: string
  displayName?: string
  role?: string
  rescueGroupsOrgId?: string
  createdAt?: any
  lastLoginAt?: any
}

const UserManagement: React.FC = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    role: 'volunteer'
  })

  // Load current user's organization ID and then load users
  useEffect(() => {
    if (!user?.uid) return

    const loadUsers = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get current user's document to find their organization ID
        const currentUserDoc = await getDoc(doc(db, 'users', user.uid))
        if (!currentUserDoc.exists()) {
          setError('Current user document not found')
          setLoading(false)
          return
        }

        const currentUserData = currentUserDoc.data()
        const userOrgId = currentUserData?.rescueGroupsOrgId

        if (!userOrgId) {
          setError('No organization ID found for current user')
          setLoading(false)
          return
        }

        console.log('Loading users for organization:', userOrgId)

        // Listen for users with matching organization ID
        const usersQuery = query(
          collection(db, 'users'),
          where('rescueGroupsOrgId', '==', userOrgId)
        )

        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
          const usersList: User[] = []
          snapshot.forEach((doc) => {
            const userData = doc.data()
            usersList.push({
              id: doc.id,
              email: userData.email || 'No email',
              displayName: userData.displayName || 'No name',
              role: userData.role || 'volunteer',
              rescueGroupsOrgId: userData.rescueGroupsOrgId,
              createdAt: userData.createdAt,
              lastLoginAt: userData.lastLoginAt
            })
          })
          
          console.log('Loaded users:', usersList.length)
          setUsers(usersList)
          setLoading(false)
        }, (error) => {
          console.error('Error loading users:', error)
          setError('Failed to load users: ' + error.message)
          setLoading(false)
        })

        return unsubscribe
      } catch (error: any) {
        console.error('Error in loadUsers:', error)
        setError('Failed to load users: ' + error.message)
        setLoading(false)
      }
    }

    loadUsers()
  }, [user?.uid])

  const handleAddUser = () => {
    setFormData({
      email: '',
      displayName: '',
      role: 'volunteer'
    })
    setEditingUser(null)
    setShowForm(true)
  }

  const handleEditUser = (user: User) => {
    setFormData({
      email: user.email,
      displayName: user.displayName || '',
      role: user.role || 'volunteer'
    })
    setEditingUser(user)
    setShowForm(true)
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      await deleteDoc(doc(db, 'users', userId))
      console.log('User deleted successfully')
    } catch (error: any) {
      console.error('Error deleting user:', error)
      setError('Failed to delete user: ' + error.message)
    }
  }

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        // Update existing user
        await updateDoc(doc(db, 'users', editingUser.id), {
          email: formData.email,
          displayName: formData.displayName,
          role: formData.role
        })
        console.log('User updated successfully')
      } else {
        // Add new user
        const currentUserDoc = await getDoc(doc(db, 'users', user!.uid))
        const currentUserData = currentUserDoc.data()
        const userOrgId = currentUserData?.rescueGroupsOrgId

        await addDoc(collection(db, 'users'), {
          email: formData.email,
          displayName: formData.displayName,
          role: formData.role,
          rescueGroupsOrgId: userOrgId,
          createdAt: new Date()
        })
        console.log('User added successfully')
      }

      setShowForm(false)
      setEditingUser(null)
      setFormData({
        email: '',
        displayName: '',
        role: 'volunteer'
      })
    } catch (error: any) {
      console.error('Error saving user:', error)
      setError('Failed to save user: ' + error.message)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingUser(null)
    setFormData({
      email: '',
      displayName: '',
      role: 'volunteer'
    })
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        </div>
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="px-6 py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading users...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <button
          onClick={handleAddUser}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Users ({filteredUsers.length})
          </h3>
        </div>
        
        {filteredUsers.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.displayName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin' ? 'bg-red-100 text-red-800' :
                        user.role === 'founder' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'staff' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit User Form */}
      {showForm && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Display Name
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="volunteer">Volunteer</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="founder">Founder</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              onClick={handleSaveUser}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {editingUser ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement