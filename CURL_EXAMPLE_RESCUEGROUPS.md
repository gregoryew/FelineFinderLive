# RescueGroups API Call - Fetch Cats for Organization

## Curl Command

```bash
curl -X GET "https://api.rescuegroups.org/v5/public/orgs/ORGANIZATION_ID/animals/search/available/cats/" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: YOUR_API_KEY"
```

## Example with Real Values

Replace:
- `ORGANIZATION_ID` with your organization ID (e.g., "401", "1103")
- `YOUR_API_KEY` with your RescueGroups API key

```bash
curl -X GET "https://api.rescuegroups.org/v5/public/orgs/401/animals/search/available/cats/" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: eqXAy6VJ"
```

## With Limit Parameter

You can optionally add a limit parameter:

```bash
curl -X GET "https://api.rescuegroups.org/v5/public/orgs/401/animals/search/available/cats/?limit=25" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: eqXAy6VJ"
```

## Pretty Print Response (using jq)

To format the JSON response nicely:

```bash
curl -X GET "https://api.rescuegroups.org/v5/public/orgs/ORGANIZATION_ID/animals/search/available/cats/" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: YOUR_API_KEY" | jq '.'
```

## Notes

- **Endpoint**: `https://api.rescuegroups.org/v5/public/orgs/{ORGANIZATION_ID}/animals/search/available/cats/`
- **Method**: GET
- **Content-Type**: `application/vnd.api+json`
- **Authorization**: `YOUR_API_KEY` (direct API key, no "apikey " prefix)
- **Query Parameters** (optional):
  - `limit`: Maximum number of results (e.g., `?limit=25`)

The response will include:
- `data`: Array of animal objects with `id`, `type`, and `attributes`
- `included`: Array of related resources (pictures, organizations, etc.)

## Response Structure

The response follows JSON:API format:
```json
{
  "data": [
    {
      "id": "12345",
      "type": "animals",
      "attributes": {
        "name": "Fluffy",
        "breedPrimary": "Domestic Short Hair",
        "ageGroup": "Adult",
        "sex": "Female"
      },
      "relationships": {
        "pictures": {
          "data": [
            { "id": "pic1", "type": "pictures" }
          ]
        }
      }
    }
  ],
  "included": [
    {
      "id": "pic1",
      "type": "pictures",
      "attributes": {
        "pictureUrl": "https://...",
        "order": 0
      },
      "relationships": {
        "animal": {
          "data": { "id": "12345", "type": "animals" }
        }
      }
    }
  ]
}
```
