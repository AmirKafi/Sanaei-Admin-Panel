import { getSetting, upsertSetting } from "./db"

export type PanelSettings = {
  panelUrl: string
  username: string
  password: string
  checkIntervalSeconds: number
}

const settingKeys = {
  panelUrl: "panelUrl",
  username: "panelUsername",
  password: "panelPassword",
  checkIntervalSeconds: "checkIntervalSeconds",
} as const

type SettingKey = keyof typeof settingKeys

async function getSettingValue(key: SettingKey): Promise<string | null> {
  return await getSetting(settingKeys[key])
}

async function setSettingValue(key: SettingKey, value: string) {
  await upsertSetting(settingKeys[key], value)
}

export async function getPanelSettings(): Promise<PanelSettings> {
  const panelUrl = (await getSettingValue("panelUrl")) ?? ""
  const username = (await getSettingValue("username")) ?? ""
  const password = (await getSettingValue("password")) ?? ""
  const checkIntervalSeconds = Number((await getSettingValue("checkIntervalSeconds")) ?? "60") || 60

  if (!panelUrl || !username || !password) {
    throw new Error("Panel settings are not configured.")
  }

  return { panelUrl, username, password, checkIntervalSeconds }
}

export async function savePanelSettings(settings: PanelSettings) {
  await Promise.all([
    setSettingValue("panelUrl", settings.panelUrl),
    setSettingValue("username", settings.username),
    setSettingValue("password", settings.password),
    setSettingValue("checkIntervalSeconds", String(settings.checkIntervalSeconds)),
  ])
}

export async function panelIsConfigured(): Promise<boolean> {
  try {
    await getPanelSettings()
    return true
  } catch {
    return false
  }
}

export function getPanelRootUrl(settings: PanelSettings) {
  const url = new URL(settings.panelUrl)

  let path = url.pathname.replace(/\/+$|^\/$/g, "")
  if (path.endsWith("/panel/api")) {
    path = path.slice(0, -"/panel/api".length)
  } else if (path.endsWith("/xui/api")) {
    path = path.slice(0, -"/xui/api".length)
  } else if (path.endsWith("/panel")) {
    path = path.slice(0, -"/panel".length)
  } else if (path.endsWith("/xui")) {
    path = path.slice(0, -"/xui".length)
  } else if (path.endsWith("/api")) {
    path = path.slice(0, -"/api".length)
  }

  url.pathname = path || "/"
  return url.toString().replace(/\/$/, "")
}

async function loginToPanel(settings: PanelSettings) {
  const baseUrl = getPanelRootUrl(settings)
  const loginPaths = ["/login", "/panel/login", "/panel/api/login", "/api/login"]
  const errors: string[] = []

  for (const loginPath of loginPaths) {
    const url = `${baseUrl}${loginPath}`
    let response: Response

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: settings.username,
          password: settings.password,
        }),
        cache: "no-store",
      })
    } catch (error) {
      errors.push(`${loginPath}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      if (response.status === 404) {
        errors.push(
          `${loginPath}: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`
        )
        continue
      }
      throw new Error(
        `Failed to authenticate with Sanaei panel at ${loginPath}: ${response.status} ${response.statusText}` +
          (text ? ` - ${text}` : "")
      )
    }

    const setCookie = response.headers.get("set-cookie")
    if (!setCookie) {
      const text = await response.text().catch(() => "")
      errors.push(
        `${loginPath}: no session cookie returned${text ? ` - ${text}` : ""}`
      )
      continue
    }

    return { baseUrl, cookie: setCookie }
  }

  throw new Error(
    `Failed to authenticate with Sanaei panel. Tried login endpoints: ${errors.join("; ")}`
  )
}

export async function panelApiRequest(
  path: string,
  method: string = "GET",
  body?: unknown
) {
  console.log("[panelApiRequest] Starting request:", { path, method, bodyKeys: body && typeof body === 'object' ? Object.keys(body) : null })
  
  const settings = await getPanelSettings()
  const login = await loginToPanel(settings)

  const prefixes = ["/panel/api", "/xui/api", "/api"]
  const headers: Record<string, string> = {
    Cookie: login.cookie,
  }
  if (body != null) {
    headers["Content-Type"] = "application/json"
  }

  const baseUrl = login.baseUrl.replace(/\/+$/, "")
  const errors: string[] = []
  for (const prefix of prefixes) {
    const url = `${baseUrl}${prefix}${path}`
    let response: Response

    try {
      console.log(`[panelApiRequest] Trying ${prefix} at:`, url)
      response = await fetch(url, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
        cache: "no-store",
      })
      console.log(`[panelApiRequest] Response status:`, { prefix, status: response.status })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      errors.push(`${prefix}: ${errMsg}`)
      console.error(`[panelApiRequest] Fetch error at ${prefix}:`, errMsg)
      continue
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      console.error(`[panelApiRequest] Non-OK response:`, { prefix, status: response.status, text })
      if (response.status === 404) {
        errors.push(
          `${prefix}${path}: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`
        )
        continue
      }
      throw new Error(
        `Sanaei API request failed at ${prefix}${path}: ${response.status} ${response.statusText}` +
          (text ? ` - ${text}` : "")
      )
    }

    const jsonResp = await response.json()
    console.log(`[panelApiRequest] Success response:`, { prefix, responseKeys: jsonResp && typeof jsonResp === 'object' ? Object.keys(jsonResp) : null })
    return jsonResp
  }

  console.error(`[panelApiRequest] All prefixes failed:`, errors)
  throw new Error(
    `Sanaei API request failed for all known prefixes: ${errors.join("; ")}`
  )
}
