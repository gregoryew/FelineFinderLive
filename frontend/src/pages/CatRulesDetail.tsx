import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { Navigate } from 'react-router-dom'
import { Save, X, Plus, Trash2, ArrowLeft, User, Clock, Calendar } from 'lucide-react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import VolunteerLookAhead from '../components/VolunteerLookAhead'

interface Pet {
  id?: string
  catId: number
  assignedVolunteers?: string[]
  exceptions?: Array<{
    id?: string
    day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    startTime: string
    endTime: string
    reason: string
  }>
}

interface Volunteer {
  id: string
  name: string
  email: string
}

interface CatInfo {
  name: string
  pictureUrl?: string
}

const CatRulesDetail: React.FC = () => {
  const { catId } = useParams<{ catId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isNew = catId === 'new'

  const [pet, setPet] = useState<Pet>({
    catId: 0,
    assignedVolunteers: [],
    exceptions: []
  })
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [catInfo, setCatInfo] = useState<CatInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catIdInput, setCatIdInput] = useState('')

  useEffect(() => {
    if (!isNew && catId && user) {
      loadPet()
      loadCatInfo(parseInt(catId))
    } else if (isNew) {
      setLoading(false)
    }
  }, [catId, user, isNew])

  const loadCatInfo = async (animalId: number) => {
    try {
      const functions = getFunctions()
      const getAllCatsFunc = httpsCallable(functions, 'getAllCatsByOrgId')
      const response = await getAllCatsFunc({})
      const result = response.data as { success: boolean; cats: Array<{ animalId: number; name: string; pictureUrl?: string }> }
      
      if (result.success && result.cats) {
        const cat = result.cats.find(c => c.animalId === animalId)
        if (cat) {
          setCatInfo({
            name: cat.name,
            pictureUrl: cat.pictureUrl
          })
        } else {
          // Fallback if cat not found
          setCatInfo({
            name: `Cat ID: ${animalId}`,
            pictureUrl: undefined
          })
        }
      }
    } catch (err: any) {
      console.error('Error loading cat info:', err)
      // Don't set error state - just use fallback
      setCatInfo({
        name: `Cat ID: ${parseInt(catId!)}`,
        pictureUrl: undefined
      })
    }
  }

  const loadPet = async () => {
    try {
      setLoading(true)
      setError(null)

      const functions = getFunctions()
      const getPetFunc = httpsCallable(functions, 'getPet')
      const response = await getPetFunc({ catId: parseInt(catId!) })

      const result = response.data as { success: boolean; pet: Pet }

      if (result.success && result.pet) {
        const loadedPet = result.pet
        setPet({
          ...loadedPet,
          exceptions: loadedPet.exceptions || []
        })
        setCatIdInput(loadedPet.catId.toString())
        await loadVolunteers(loadedPet.assignedVolunteers || [])
      }
    } catch (err: any) {
      console.error('Error loading pet:', err)
      setError(err.message || 'Failed to load pet')
    } finally {
      setLoading(false)
    }
  }

  const loadVolunteers = async (volunteerIds: string[]) => {
    if (volunteerIds.length === 0) {
      setVolunteers([])
      return
    }

    try {
      // Load volunteer details from Firestore
      const { doc, getDoc } = await import('firebase/firestore')
      const { db } = await import('../services/firebase')

      const volunteerPromises = volunteerIds.map(async (id) => {
        const volunteerDoc = await getDoc(doc(db, 'team', id))
        if (volunteerDoc.exists()) {
          const data = volunteerDoc.data()
          return {
            id: volunteerDoc.id,
            name: data.name || data.displayName || data.email || 'Unknown',
            email: data.email || ''
          } as Volunteer
        }
        return null
      })

      const loadedVolunteers = (await Promise.all(volunteerPromises)).filter(v => v !== null) as Volunteer[]
      setVolunteers(loadedVolunteers)
    } catch (err) {
      console.error('Error loading volunteers:', err)
    }
  }

  const handleAddVolunteer = (volunteer: Volunteer) => {
    if (volunteers.find(v => v.id === volunteer.id)) {
      return // Already added
    }

    const newVolunteers = [...volunteers, volunteer]
    setVolunteers(newVolunteers)
    setPet({
      ...pet,
      assignedVolunteers: newVolunteers.map(v => v.id)
    })
  }

  const handleRemoveVolunteer = (volunteerId: string) => {
    const newVolunteers = volunteers.filter(v => v.id !== volunteerId)
    setVolunteers(newVolunteers)
    setPet({
      ...pet,
      assignedVolunteers: newVolunteers.map(v => v.id)
    })
  }

  const handleAddException = () => {
    const newException = {
      id: Date.now().toString(),
      day: 'monday' as const,
      startTime: '09:00',
      endTime: '17:00',
      reason: ''
    }
    setPet({
      ...pet,
      exceptions: [...(pet.exceptions || []), newException]
    })
  }

  const handleRemoveException = (index: number) => {
    const newExceptions = pet.exceptions?.filter((_, i) => i !== index) || []
    setPet({
      ...pet,
      exceptions: newExceptions
    })
  }

  const handleUpdateException = (index: number, field: string, value: string) => {
    const newExceptions = [...(pet.exceptions || [])]
    newExceptions[index] = {
      ...newExceptions[index],
      [field]: value
    }
    setPet({
      ...pet,
      exceptions: newExceptions
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (!isNew && !catIdInput.trim()) {
        setError('Cat ID is required')
        return
      }

      const catIdValue = isNew ? parseInt(catIdInput) : parseInt(catId!)

      if (isNaN(catIdValue)) {
        setError('Invalid Cat ID')
        return
      }

      const petToSave: Pet = {
        catId: catIdValue,
        assignedVolunteers: pet.assignedVolunteers || [],
        exceptions: pet.exceptions?.map(({ id, ...rest }) => rest) || [] // Remove frontend-only id
      }

      const functions = getFunctions()
      const savePetFunc = httpsCallable(functions, 'savePet')
      await savePetFunc({ pet: petToSave })

      // Navigate back to list
      navigate('/cat-rules')
    } catch (err: any) {
      console.error('Error saving pet:', err)
      setError(err.message || 'Failed to save pet')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return <Navigate to="/access-denied?error=AUTHENTICATION_REQUIRED" replace />
  }

  if (loading) {
    return (
      <div className="py-8 max-w-7xl mx-auto px-4">
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-feline-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading cat rules...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8 max-w-7xl mx-auto px-4">
      <div className="mb-6">
        <button
          onClick={() => navigate('/cat-rules')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Cat Rules
        </button>
        {isNew ? (
          <h1 className="text-2xl font-bold text-gray-900">Add Cat Rules</h1>
        ) : catInfo ? (
          <div className="flex items-center gap-3">
            {catInfo.pictureUrl ? (
              <img
                src={catInfo.pictureUrl}
                alt={catInfo.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : null}
            <h1 className="text-2xl font-bold text-gray-900">{catInfo.name}</h1>
          </div>
        ) : (
          <h1 className="text-2xl font-bold text-gray-900">Cat Rules - Cat ID: {pet.catId}</h1>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          {isNew && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cat ID (RescueGroups Animal ID)
              </label>
              <input
                type="number"
                value={catIdInput}
                onChange={(e) => setCatIdInput(e.target.value)}
                placeholder="Enter cat ID"
                className="border rounded-md px-3 py-2 w-full max-w-xs"
              />
            </div>
          )}

          <h2 className="text-lg font-medium text-gray-900 mb-4">Assigned Volunteers</h2>
          <p className="text-sm text-gray-500 mb-4">
            Select volunteers who are allowed to show this cat. Leave empty to allow all volunteers.
          </p>

          <VolunteerLookAhead
            onAdd={handleAddVolunteer}
            excludeIds={volunteers.map(v => v.id)}
            className="mb-4"
          />

          {volunteers.length > 0 && (
            <div className="mt-4">
              <ul className="space-y-2">
                {volunteers.map((volunteer) => (
                  <li key={volunteer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center">
                      <User className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <div className="font-medium text-gray-900">{volunteer.name}</div>
                        {volunteer.email && (
                          <div className="text-sm text-gray-500">{volunteer.email}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveVolunteer(volunteer.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1 text-center">
              <h2 className="text-lg font-medium text-gray-900">Availability Exceptions</h2>
              <p className="text-sm text-gray-500 mt-1">
                Define times when this cat is not available for appointments
              </p>
            </div>
            <button
              onClick={handleAddException}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Exception
            </button>
          </div>

          {pet.exceptions && pet.exceptions.length > 0 ? (
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200"> económ
                  {pet.exceptions.map((exception, index) => (
                    <tr key={exception.id || index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={exception.day}
                          onChange={(e) => handleUpdateException(index, 'day', e.target.value)}
                          className="border rounded-md px-3 py-1 text-sm"
                        >
                          <option value="monday">Monday</option>
                          <option value="tuesday">Tuesday</option>
                          <option value="wednesday">Wednesday</option>
                          <option value="thursday">Thursday</option>
                          <option value="friday">Friday</option>
                          <option value="saturday">Saturday</option>
                          <option value="sunday">Sunday</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="time"
                          value={exception.startTime}
                          onChange={(e) => handleUpdateException(index, 'startTime', e.target.value)}
                          className="border rounded-md px-3 py-1 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="time"
                          value={exception.endTime}
                          onChange={(e) => handleUpdateException(index, 'endTime', e.target.value)}
                          className="border rounded-md px-3 py-1 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={exception.reason}
                          onChange={(e) => handleUpdateException(index, 'reason', e.target.value)}
                          placeholder="Reason for exception"
                          className="border rounded-md px-3 py-1 text-sm w-full"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleRemoveException(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No availability exceptions</p>
              <p className="text-sm">Click "Add Exception" to define unavailable times</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={() => navigate('/cat-rules')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (isNew && !catIdInput.trim())}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-feline-600 hover:bg-feline-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CatRulesDetail

