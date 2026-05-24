import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const confirmed =
  process.argv.includes("--yes") ||
  process.argv.includes("-y") ||
  process.env.CLEAR_CLIENTS_YES === "1"

async function clearClients() {
  const clientCount = await prisma.client.count()
  const linkCount = await prisma.clientInbound.count()
  const snapshotCount = await prisma.usageSnapshot.count()

  if (clientCount === 0 && linkCount === 0 && snapshotCount === 0) {
    console.log("Database already has no clients.")
    return
  }

  if (!confirmed) {
    console.error("This will permanently delete:")
    console.error(`  - ${clientCount} client(s)`)
    console.error(`  - ${linkCount} client–inbound link(s)`)
    console.error(`  - ${snapshotCount} usage snapshot(s)`)
    console.error("Inbounds are kept; only clientCount is reset to 0.")
    console.error("")
    console.error("To proceed, run:")
    console.error("  npm run clear:clients -- --yes")
    process.exit(1)
  }

  try {
    console.log("Clearing clients from database...")

    await prisma.$transaction(async (tx) => {
      const deletedSnapshots = await tx.usageSnapshot.deleteMany({})
      console.log(`Deleted ${deletedSnapshots.count} usage snapshot(s)`)

      const deletedLinks = await tx.clientInbound.deleteMany({})
      console.log(`Deleted ${deletedLinks.count} client–inbound link(s)`)

      const deletedClients = await tx.client.deleteMany({})
      console.log(`Deleted ${deletedClients.count} client(s)`)

      const resetInbounds = await tx.inbound.updateMany({
        data: { clientCount: 0 },
      })
      console.log(`Reset clientCount on ${resetInbounds.count} inbound(s)`)
    })

    console.log("")
    console.log("Done. Clients list is empty.")
  } catch (error) {
    console.error("Cleanup failed:", error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

clearClients()
