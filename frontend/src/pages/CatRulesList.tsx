import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { Navigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, Cat } from 'lucide-react'
import { getFunctions, httpsCallable } from 'firebase/functions'

interface Pet {
  id: string
  catId: number
  assignedVolunteers?: string[]
  exceptions?: Array<{
    day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    startTime: string
    endTime: string
    reason: string
  }>
}

const CatRulesList: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadPets()
    }
  }, [user])

  const loadPets = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const functions = getFunctions()
      const getPetsFunc = httpsCallable(functions, 'getPets')
      const response = await getPetsFunc({})

      const result = response.data as { success: boolean; pets: Pet[] }

      if (result.success) {
        setPets(result.pets || [])
      } else {
        setError('Failed to load pets')
      }
    } catch (err: any) {
      console.error('Error loading pets:', err)
      setError(err.message || 'Failed to load pets')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (pet: Pet) => {
    if (!confirm(`Are you sure you want to delete rules for cat ID ${pet.catId}?`)) {
      return
    }

    try {
      setDeletingId(pet.id)
      const functions = getFunctions()
      const deletePetFunc = httpsCallable(functions, 'deletePet')
      await deletePetFunc({ catId: pet.catId })

      // Reload pets
      await loadPets()
    } catch (err: any) {
      console.error('Error deleting pet:', err)
      alert(err.message || 'Failed to delete pet')
    } finally {
      setDeletingId(null)
    }
  }

  if (!user) {
    return <Navigate to="/access-denied?error=AUTHENTICATION_REQUIRED" replace />
  }

  return (
    <div className="py-8 max-w-7xl mx-auto px-4">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cat Rules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage availability rules and volunteer assignments for cats
          </p>
        </div>
        <button
          onClick={() => navigate('/cat-rules/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-feline-600 hover:bg-feline-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Cat Rules
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-feline-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading cat rules...</p>
        </div>
      ) : pets.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <Cat className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No cat rules found</p>
          <p className="text-sm text-gray-400 mt-2">
            Click "Add Cat Rules" to create rules for a cat
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {pets.map((pet) => (
              <li key={pet.id}>
                <div className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center flex-1">
                    <Cat className="w-8 h-8 text-feline-600 mr-4" />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900">
                          Cat ID: {pet.catId}
                        </h3>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {pet.assignedVolunteers?.length || 0} assigned volunteer{pet.assignedVolunteers?.length !== 1 ? 's' : ''} • {' '}
                        {pet.exceptions?.length || 0} availability exception{pet.exceptions?.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigate(`/cat-rules/${pet.catId}`)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(pet)}
                      disabled={deletingId === pet.id}
                      className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {deletingId === pet.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default CatRulesList

