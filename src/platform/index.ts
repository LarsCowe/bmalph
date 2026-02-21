export type {
  Platform,
  PlatformId,
  PlatformTier,
  CommandDelivery,
  PlatformDoctorCheck,
} from "./types.js";
export { getPlatform, getAllPlatforms, isPlatformId } from "./registry.js";
export { resolveProjectPlatform } from "./resolve.js";
export { detectPlatform } from "./detect.js";
