/** Bundle browser code using the same module-loader contract as DSH plugins. */
import { build } from 'esbuild'
await build({
  entryPoints: ['src/client.tsx'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', format: 'cjs', target: 'es2022', packages: 'external',
  banner: { js: 'window.__ModuleLoader__.load({id:"dsh-workbuddy",factory:(require)=>{var module={exports:{}};var exports=module.exports;' },
  footer: { js: 'return module.exports;}});' },
})
