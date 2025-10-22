import { z } from "zod"

const client_id = process.env.GOOGLE_CLIENT_ID
const client_secret = process.env.GOOGLE_CLIENT_SECRET
const redirect_uri = process.env.GOOGLE_REDIRECT_URI
const url = "https://oauth2.googleapis.com/token"

const ResponseSchema = z.object({
    access_token: z.string(),
    id_token: z.string(),
    expires_in: z.number(),
    token_type: z.literal("Bearer"),
    scope: z.string(),
})

const getIdToken = async (code: string): Promise<string | null> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, client_id, client_secret, redirect_uri, grant_type: "authorization_code" })
    })
    if (!response.ok) return null
    const data = await response.json()
    const result = ResponseSchema.safeParse(data)
    if (result.success === false) return null
    return result.data.id_token
  } catch {
      return null
  }
}

export default getIdToken
