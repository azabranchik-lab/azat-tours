// Photo storage contract (SPEC §2). Paths are relative ("{carId}/{file}"), so the
// local folder can later be swapped for S3 / Cloudflare R2 without touching callers.
//
//   save(relPath, buffer)   -> Promise<void>
//   read(relPath)           -> Promise<Buffer>
//   delete(relPath)         -> Promise<void>   (missing file is not an error)
//   deleteDir(relDir)       -> Promise<void>   (all photos of one car)
//   publicUrl(relPath)      -> string          (served by server.js only for APPROVED cars)
//   freeBytes()             -> number | null   (free disk space, null if unknown)
//   usedBytes()             -> number          (size of all stored photos)
module.exports = {};
