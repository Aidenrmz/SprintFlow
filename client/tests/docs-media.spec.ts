import { expect, test, type Page } from "@playwright/test"
import GIFEncoder from "gif-encoder-2"
import { PNG } from "pngjs"
import fs from "fs"
import path from "path"

const assetsDir = path.resolve(process.cwd(), "../docs/assets")
const gifFrameDelay = 900

type GifFrame = {
  name: string
  buffer: Buffer
}

const prepareAssetsDir = () => {
  fs.mkdirSync(assetsDir, { recursive: true })
  for (const file of fs.readdirSync(assetsDir)) {
    if (file.endsWith(".png") || file.endsWith(".gif")) fs.rmSync(path.join(assetsDir, file), { force: true })
  }
}

const assetPath = (filename: string) => path.join(assetsDir, filename)

const waitForApp = async (page: Page) => {
  await page.waitForLoadState("networkidle")
}

const capture = async (page: Page, filename: string) => {
  await waitForApp(page)
  await page.screenshot({ path: assetPath(filename), fullPage: true })
}

const captureGifFrame = async (page: Page, name: string): Promise<GifFrame> => {
  await waitForApp(page)
  return {
    name,
    buffer: await page.screenshot({ fullPage: false })
  }
}

const writeGif = (frames: GifFrame[], filename: string) => {
  if (!frames.length) return

  const pngFrames = frames.map((frame) => PNG.sync.read(frame.buffer))
  const { width, height } = pngFrames[0]
  const encoder = new GIFEncoder(width, height, "octree", true, pngFrames.length)

  encoder.start()
  encoder.setRepeat(0)
  encoder.setDelay(gifFrameDelay)
  encoder.setQuality(10)

  for (const frame of pngFrames) {
    encoder.addFrame(frame.data)
  }

  encoder.finish()
  fs.writeFileSync(assetPath(filename), encoder.out.getData())
}

const startDemoSession = async (page: Page) => {
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Try Demo" })).toBeVisible()
  await page.getByRole("button", { name: "Try Demo" }).click()
  await page.waitForURL("**/dashboard")
  await expect(page.locator(".dashboard")).toBeVisible()
  await waitForApp(page)
}

test.describe("docs media", () => {
  test.beforeAll(() => {
    prepareAssetsDir()
  })

  test("captures screenshots and the product GIF", async ({ page }) => {
    const gifFrames: GifFrame[] = []

    await page.goto("/")
    await expect(page.getByRole("heading", { name: /SprintFlow/ })).toBeVisible()
    await capture(page, "01-landing.png")
    gifFrames.push(await captureGifFrame(page, "landing"))

    await startDemoSession(page)
    await capture(page, "02-dashboard.png")
    gifFrames.push(await captureGifFrame(page, "dashboard"))

    await page.goto("/tickets")
    await expect(page.locator(".ticketbar").first()).toBeVisible()
    await capture(page, "03-ticket-list.png")
    gifFrames.push(await captureGifFrame(page, "ticket-list"))

    await page.locator(".ticketbar").first().locator("svg").last().click()
    await page.waitForURL("**/tickets/**")
    await expect(page.locator(".details")).toBeVisible()
    await capture(page, "04-ticket-detail.png")
    gifFrames.push(await captureGifFrame(page, "ticket-detail"))

    await page.goto("/create")
    await expect(page.locator(".create form")).toBeVisible()
    await page.getByPlaceholder("The subject of the ticket.").fill("Knowledge base article needs review")
    await page.getByPlaceholder("Write description here.").fill("Support needs one reviewed article for the new workspace invitation flow.")
    await capture(page, "05-create-ticket.png")
    gifFrames.push(await captureGifFrame(page, "create-ticket"))

    await page.goto("/profile")
    await expect(page.locator(".profile")).toBeVisible()
    await capture(page, "06-profile.png")
    gifFrames.push(await captureGifFrame(page, "profile"))

    writeGif(gifFrames, "sprintflow-demo.gif")
  })
})
