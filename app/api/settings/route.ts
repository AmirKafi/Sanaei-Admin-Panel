import { NextRequest, NextResponse } from "next/server"
import { getPanelSettings, savePanelSettings } from "@/lib/sanaei"
import { upsertSetting } from "@/lib/db"
import { apiError, parseJsonBody } from "@/lib/api-response"
import { settingsPatchSchema } from "@/lib/validations"

export async function GET() {
  try {
    const settings = await getPanelSettings()
    return NextResponse.json({ ...settings, configured: true })
  } catch {
    return NextResponse.json({
      panelUrl: "",
      username: "",
      password: "",
      checkIntervalSeconds: 60,
      configured: false,
    })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request, settingsPatchSchema)
    if (!parsed.ok) return parsed.response

    const {
      panelUrl,
      username,
      password,
      checkIntervalSeconds,
      adminUsername,
      adminPassword,
    } = parsed.data

    await savePanelSettings({
      panelUrl,
      username,
      password,
      checkIntervalSeconds,
    })

    if (adminUsername) {
      await upsertSetting("adminUsername", adminUsername)
    }
    if (adminPassword) {
      await upsertSetting("adminPassword", adminPassword)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to save settings.",
      500
    )
  }
}
