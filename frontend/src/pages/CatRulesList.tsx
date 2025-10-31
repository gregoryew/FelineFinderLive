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

interface RescueGroupsCat {
  id: string
  animalId: number
  name: string
  breed: string
  age: string
  sex: string
  pictureUrl?: string
}

interface CatWithRules extends RescueGroupsCat {
  hasRules: boolean
  petDocumentId?: string
  assignedVolunteersCount?: number
  exceptionsCount?: number
}

const CatRulesList: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [cats, setCats] = useState<CatWithRules[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadAllCats()
    }
  }, [user])

  const loadAllCats = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const functions = getFunctions()
      
      // Fetch all cats from RescueGroups
      const getAllCatsFunc = httpsCallable(functions, 'getAllCatsByOrgId')
      const rescueGroupsResponse = await getAllCatsFunc({})
      const rescueGroupsResult = rescueGroupsResponse.data as { success: boolean; cats: RescueGroupsCat[] }
      
      // Fetch existing pet rules from Firestore
      const getPetsFunc = httpsCallable(functions, 'getPets')
      const petsResponse = await getPetsFunc({})
      const petsResult = petsResponse.data as { success: boolean; pets: Pet[] }

      if (rescueGroupsResult.success) {
        const rescueGroupsCats = rescueGroupsResult.cats || []
        const existingPets = petsResult.success ? (petsResult.pets || []) : []
        
        // Create a map of existing pets by catId for quick lookup
        const petsMap = new Map<number, Pet>()
        existingPets.forEach(pet => {
          petsMap.set(pet.catId, pet)
        })

        // Merge RescueGroups cats with existing pet rules
        const catsWithRules: CatWithRules[] = rescueGroupsCats.map(cat => {
          const existingPet = petsMap.get(cat.animalId)
          return {
            ...cat,
            hasRules: !!existingPet,
            petDocumentId: existingPet?.id,
            assignedVolunteersCount: existingPet?.assignedVolunteers?.length || 0,
            exceptionsCount: existingPet?.exceptions?.length || 0
          }
        })

        // Sort by name
        catsWithRules.sort((a, b) => a.name.localeCompare(b.name))
        
        setCats(catsWithRules)
      } else {
        setError('Failed to load cats from RescueGroups')
      }
    } catch (err: any) {
      console.error('Error loading cats:', err)
      setError(err.message || 'Failed to load cats')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (cat: CatWithRules) => {
    if (!cat.hasRules || !cat.petDocumentId) {
      return
    }

    if (!confirm(`Are you sure you want to delete rules for ${cat.name} (ID ${cat.animalId})?`)) {
      return
    }

    try {
      setDeletingId(cat.petDocumentId)
      const functions = getFunctions()
      const deletePetFunc = httpsCallable(functions, 'deletePet')
      await deletePetFunc({ catId: cat.animalId })

      // Reload cats
      await loadAllCats()
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
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Cat Rules</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage availability rules and volunteer assignments for cats
        </p>
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
      ) : cats.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <Cat className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No cats found</p>
          <p className="text-sm text-gray-400 mt-2">
            No available cats found for your organization
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {cats.map((cat) => (
              <li key={cat.id}>
                <div className={`px-4 py-4 flex items-center justify-between hover:bg-gray-50 ${cat.hasRules ? '' : 'bg-gray-50'}`}>
                  <div className="flex items-center flex-1">
                    {cat.pictureUrl ? (
                      <img
                        src={cat.pictureUrl}
                        alt={cat.name}
                        className="w-12 h-12 rounded-full object-cover mr-4 border-2 border-gray-200"
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          e.currentTarget.style.display = 'none'
                          const icon = e.currentTarget.nextElementSibling as HTMLElement
                          if (icon) icon.style.display = 'block'
                        }}
                      />
                    ) : null}
                    <Cat 
                      className={`w-8 h-8 mr-4 ${cat.hasRules ? 'text-feline-600' : 'text-gray-300'} ${cat.pictureUrl ? 'hidden' : ''}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900">
                          {cat.name}
                        </h3>
                        {!cat.hasRules && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            No Rules
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        ID: {cat.animalId} • {cat.breed} • {cat.age} • {cat.sex}
                        {cat.hasRules && (
                          <>
                            {' • '}
                            {cat.assignedVolunteersCount || 0} assigned volunteer{(cat.assignedVolunteersCount || 0) !== 1 ? 's' : ''}
                            {' • '}
                            {cat.exceptionsCount || 0} availability exception{(cat.exceptionsCount || 0) !== 1 ? 's' : ''}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigate(`/cat-rules/${cat.animalId}`)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      {cat.hasRules ? 'Edit' : 'Add Rules'}
                    </button>
                    {cat.hasRules && cat.petDocumentId && (
                      <button
                        onClick={() => handleDelete(cat)}
                        disabled={deletingId === cat.petDocumentId}
                        className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {deletingId === cat.petDocumentId ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
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

