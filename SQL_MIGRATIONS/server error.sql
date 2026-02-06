13:28:00.010 Running build in Washington, D.C., USA (East) – iad1
13:28:00.010 Build machine configuration: 2 cores, 8 GB
13:28:00.133 Cloning github.com/kumarnitin007/Leo (Branch: main, Commit: fc48bc3)
13:28:00.770 Cloning completed: 637.000ms
13:28:00.944 Restored build cache from previous deployment (GDbn5bSFsbQApZUTHxXyyY36SwMv)
13:28:01.192 Running "vercel build"
13:28:02.243 Vercel CLI 50.13.0
13:28:02.887 Installing dependencies...
13:28:03.947 
13:28:03.948 up to date in 823ms
13:28:03.948 
13:28:03.948 83 packages are looking for funding
13:28:03.949   run `npm fund` for details
13:28:03.979 Running "npm run build"
13:28:04.069 
13:28:04.070 > myday@1.3.132 prebuild
13:28:04.070 > node scripts/increment-version.js
13:28:04.070 
13:28:04.101 ✅ Version incremented: 1.3.135 -> 1.3.135
13:28:04.105 
13:28:04.105 > myday@1.3.132 build
13:28:04.106 > tsc && vite build
13:28:04.106 
13:28:15.318 src/components/ShareEntryModal.tsx(244,11): error TS2353: Object literal may only specify known properties, and 'userId' does not exist in type 'DocumentVault'.
13:28:15.319 src/components/ShareEntryModal.tsx(261,11): error TS2345: Argument of type 'ShareMode' is not assignable to parameter of type '"readonly" | "readwrite"'.
13:28:15.319   Type '"copy"' is not assignable to type '"readonly" | "readwrite"'.
13:28:15.352 Error: Command "npm run build" exited with 2
13:28:18.478 Error: Failed to get package info: AggregateError [ETIMEDOUT]: 
13:28:18.478     at internalConnectMultiple (node:net:1122:18)
13:28:18.478     at internalConnectMultiple (node:net:1190:5)
13:28:18.478     at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.478     at listOnTimeout (node:internal/timers:583:11)
13:28:18.478     at process.processTimers (node:internal/timers:519:7) {
13:28:18.478   code: 'ETIMEDOUT',
13:28:18.478   [errors]: [
13:28:18.478     Error: connect ETIMEDOUT 104.16.4.34:443
13:28:18.478         at createConnectionError (node:net:1652:14)
13:28:18.478         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.478         at listOnTimeout (node:internal/timers:583:11)
13:28:18.478         at process.processTimers (node:internal/timers:519:7) {
13:28:18.478       errno: -110,
13:28:18.478       code: 'ETIMEDOUT',
13:28:18.479       syscall: 'connect',
13:28:18.479       address: '104.16.4.34',
13:28:18.479       port: 443
13:28:18.479     },
13:28:18.479     Error: connect ENETUNREACH 2606:4700::6810:722:443 - Local (:::0)
13:28:18.479         at internalConnectMultiple (node:net:1186:16)
13:28:18.479         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.479         at listOnTimeout (node:internal/timers:583:11)
13:28:18.479         at process.processTimers (node:internal/timers:519:7) {
13:28:18.479       errno: -101,
13:28:18.479       code: 'ENETUNREACH',
13:28:18.479       syscall: 'connect',
13:28:18.479       address: '2606:4700::6810:722',
13:28:18.479       port: 443
13:28:18.479     },
13:28:18.479     Error: connect ETIMEDOUT 104.16.3.34:443
13:28:18.479         at createConnectionError (node:net:1652:14)
13:28:18.479         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.480         at listOnTimeout (node:internal/timers:583:11)
13:28:18.480         at process.processTimers (node:internal/timers:519:7) {
13:28:18.481       errno: -110,
13:28:18.482       code: 'ETIMEDOUT',
13:28:18.482       syscall: 'connect',
13:28:18.482       address: '104.16.3.34',
13:28:18.482       port: 443
13:28:18.482     },
13:28:18.482     Error: connect ENETUNREACH 2606:4700::6810:122:443 - Local (:::0)
13:28:18.482         at internalConnectMultiple (node:net:1186:16)
13:28:18.482         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.482         at listOnTimeout (node:internal/timers:583:11)
13:28:18.482         at process.processTimers (node:internal/timers:519:7) {
13:28:18.482       errno: -101,
13:28:18.482       code: 'ENETUNREACH',
13:28:18.482       syscall: 'connect',
13:28:18.482       address: '2606:4700::6810:122',
13:28:18.482       port: 443
13:28:18.482     },
13:28:18.482     Error: connect ETIMEDOUT 104.16.10.34:443
13:28:18.482         at createConnectionError (node:net:1652:14)
13:28:18.482         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.482         at listOnTimeout (node:internal/timers:583:11)
13:28:18.482         at process.processTimers (node:internal/timers:519:7) {
13:28:18.482       errno: -110,
13:28:18.482       code: 'ETIMEDOUT',
13:28:18.482       syscall: 'connect',
13:28:18.482       address: '104.16.10.34',
13:28:18.483       port: 443
13:28:18.483     },
13:28:18.483     Error: connect ENETUNREACH 2606:4700::6810:a22:443 - Local (:::0)
13:28:18.483         at internalConnectMultiple (node:net:1186:16)
13:28:18.483         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.483         at listOnTimeout (node:internal/timers:583:11)
13:28:18.483         at process.processTimers (node:internal/timers:519:7) {
13:28:18.483       errno: -101,
13:28:18.486       code: 'ENETUNREACH',
13:28:18.486       syscall: 'connect',
13:28:18.486       address: '2606:4700::6810:a22',
13:28:18.486       port: 443
13:28:18.486     },
13:28:18.486     Error: connect ETIMEDOUT 104.16.9.34:443
13:28:18.486         at createConnectionError (node:net:1652:14)
13:28:18.486         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.486         at listOnTimeout (node:internal/timers:583:11)
13:28:18.486         at process.processTimers (node:internal/timers:519:7) {
13:28:18.486       errno: -110,
13:28:18.486       code: 'ETIMEDOUT',
13:28:18.486       syscall: 'connect',
13:28:18.486       address: '104.16.9.34',
13:28:18.486       port: 443
13:28:18.486     },
13:28:18.486     Error: connect ENETUNREACH 2606:4700::6810:622:443 - Local (:::0)
13:28:18.486         at internalConnectMultiple (node:net:1186:16)
13:28:18.486         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.486         at listOnTimeout (node:internal/timers:583:11)
13:28:18.486         at process.processTimers (node:internal/timers:519:7) {
13:28:18.486       errno: -101,
13:28:18.487       code: 'ENETUNREACH',
13:28:18.487       syscall: 'connect',
13:28:18.487       address: '2606:4700::6810:622',
13:28:18.487       port: 443
13:28:18.487     },
13:28:18.487     Error: connect ETIMEDOUT 104.16.11.34:443
13:28:18.487         at createConnectionError (node:net:1652:14)
13:28:18.487         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.487         at listOnTimeout (node:internal/timers:583:11)
13:28:18.487         at process.processTimers (node:internal/timers:519:7) {
13:28:18.487       errno: -110,
13:28:18.487       code: 'ETIMEDOUT',
13:28:18.487       syscall: 'connect',
13:28:18.487       address: '104.16.11.34',
13:28:18.487       port: 443
13:28:18.487     },
13:28:18.487     Error: connect ENETUNREACH 2606:4700::6810:922:443 - Local (:::0)
13:28:18.487         at internalConnectMultiple (node:net:1186:16)
13:28:18.487         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.487         at listOnTimeout (node:internal/timers:583:11)
13:28:18.487         at process.processTimers (node:internal/timers:519:7) {
13:28:18.487       errno: -101,
13:28:18.487       code: 'ENETUNREACH',
13:28:18.487       syscall: 'connect',
13:28:18.487       address: '2606:4700::6810:922',
13:28:18.488       port: 443
13:28:18.488     },
13:28:18.488     Error: connect ETIMEDOUT 104.16.6.34:443
13:28:18.488         at createConnectionError (node:net:1652:14)
13:28:18.488         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.488         at listOnTimeout (node:internal/timers:583:11)
13:28:18.488         at process.processTimers (node:internal/timers:519:7) {
13:28:18.488       errno: -110,
13:28:18.488       code: 'ETIMEDOUT',
13:28:18.488       syscall: 'connect',
13:28:18.488       address: '104.16.6.34',
13:28:18.488       port: 443
13:28:18.488     },
13:28:18.488     Error: connect ENETUNREACH 2606:4700::6810:b22:443 - Local (:::0)
13:28:18.488         at internalConnectMultiple (node:net:1186:16)
13:28:18.490         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.490         at listOnTimeout (node:internal/timers:583:11)
13:28:18.490         at process.processTimers (node:internal/timers:519:7) {
13:28:18.490       errno: -101,
13:28:18.490       code: 'ENETUNREACH',
13:28:18.490       syscall: 'connect',
13:28:18.491       address: '2606:4700::6810:b22',
13:28:18.491       port: 443
13:28:18.491     },
13:28:18.491     Error: connect ETIMEDOUT 104.16.2.34:443
13:28:18.491         at createConnectionError (node:net:1652:14)
13:28:18.491         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.491         at listOnTimeout (node:internal/timers:583:11)
13:28:18.491         at process.processTimers (node:internal/timers:519:7) {
13:28:18.491       errno: -110,
13:28:18.491       code: 'ETIMEDOUT',
13:28:18.491       syscall: 'connect',
13:28:18.492       address: '104.16.2.34',
13:28:18.492       port: 443
13:28:18.492     },
13:28:18.492     Error: connect ENETUNREACH 2606:4700::6810:822:443 - Local (:::0)
13:28:18.492         at internalConnectMultiple (node:net:1186:16)
13:28:18.492         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.492         at listOnTimeout (node:internal/timers:583:11)
13:28:18.492         at process.processTimers (node:internal/timers:519:7) {
13:28:18.492       errno: -101,
13:28:18.492       code: 'ENETUNREACH',
13:28:18.492       syscall: 'connect',
13:28:18.493       address: '2606:4700::6810:822',
13:28:18.493       port: 443
13:28:18.493     },
13:28:18.493     Error: connect ETIMEDOUT 104.16.7.34:443
13:28:18.493         at createConnectionError (node:net:1652:14)
13:28:18.493         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.493         at listOnTimeout (node:internal/timers:583:11)
13:28:18.493         at process.processTimers (node:internal/timers:519:7) {
13:28:18.493       errno: -110,
13:28:18.493       code: 'ETIMEDOUT',
13:28:18.493       syscall: 'connect',
13:28:18.493       address: '104.16.7.34',
13:28:18.494       port: 443
13:28:18.494     },
13:28:18.494     Error: connect ENETUNREACH 2606:4700::6810:522:443 - Local (:::0)
13:28:18.494         at internalConnectMultiple (node:net:1186:16)
13:28:18.494         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.494         at listOnTimeout (node:internal/timers:583:11)
13:28:18.494         at process.processTimers (node:internal/timers:519:7) {
13:28:18.494       errno: -101,
13:28:18.494       code: 'ENETUNREACH',
13:28:18.494       syscall: 'connect',
13:28:18.494       address: '2606:4700::6810:522',
13:28:18.494       port: 443
13:28:18.494     },
13:28:18.494     Error: connect ETIMEDOUT 104.16.0.34:443
13:28:18.494         at createConnectionError (node:net:1652:14)
13:28:18.494         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.494         at listOnTimeout (node:internal/timers:583:11)
13:28:18.495         at process.processTimers (node:internal/timers:519:7) {
13:28:18.495       errno: -110,
13:28:18.495       code: 'ETIMEDOUT',
13:28:18.495       syscall: 'connect',
13:28:18.495       address: '104.16.0.34',
13:28:18.495       port: 443
13:28:18.495     },
13:28:18.495     Error: connect ENETUNREACH 2606:4700::6810:322:443 - Local (:::0)
13:28:18.495         at internalConnectMultiple (node:net:1186:16)
13:28:18.495         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.495         at listOnTimeout (node:internal/timers:583:11)
13:28:18.495         at process.processTimers (node:internal/timers:519:7) {
13:28:18.495       errno: -101,
13:28:18.495       code: 'ENETUNREACH',
13:28:18.495       syscall: 'connect',
13:28:18.495       address: '2606:4700::6810:322',
13:28:18.495       port: 443
13:28:18.495     },
13:28:18.496     Error: connect ETIMEDOUT 104.16.1.34:443
13:28:18.496         at createConnectionError (node:net:1652:14)
13:28:18.496         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.496         at listOnTimeout (node:internal/timers:583:11)
13:28:18.496         at process.processTimers (node:internal/timers:519:7) {
13:28:18.496       errno: -110,
13:28:18.496       code: 'ETIMEDOUT',
13:28:18.496       syscall: 'connect',
13:28:18.496       address: '104.16.1.34',
13:28:18.496       port: 443
13:28:18.496     },
13:28:18.496     Error: connect ENETUNREACH 2606:4700::6810:422:443 - Local (:::0)
13:28:18.496         at internalConnectMultiple (node:net:1186:16)
13:28:18.496         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.496         at listOnTimeout (node:internal/timers:583:11)
13:28:18.496         at process.processTimers (node:internal/timers:519:7) {
13:28:18.497       errno: -101,
13:28:18.497       code: 'ENETUNREACH',
13:28:18.497       syscall: 'connect',
13:28:18.497       address: '2606:4700::6810:422',
13:28:18.497       port: 443
13:28:18.497     },
13:28:18.497     Error: connect ETIMEDOUT 104.16.5.34:443
13:28:18.497         at createConnectionError (node:net:1652:14)
13:28:18.497         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.497         at listOnTimeout (node:internal/timers:583:11)
13:28:18.497         at process.processTimers (node:internal/timers:519:7) {
13:28:18.497       errno: -110,
13:28:18.497       code: 'ETIMEDOUT',
13:28:18.497       syscall: 'connect',
13:28:18.497       address: '104.16.5.34',
13:28:18.497       port: 443
13:28:18.497     },
13:28:18.497     Error: connect ENETUNREACH 2606:4700::6810:22:443 - Local (:::0)
13:28:18.497         at internalConnectMultiple (node:net:1186:16)
13:28:18.497         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.497         at listOnTimeout (node:internal/timers:583:11)
13:28:18.497         at process.processTimers (node:internal/timers:519:7) {
13:28:18.502       errno: -101,
13:28:18.502       code: 'ENETUNREACH',
13:28:18.502       syscall: 'connect',
13:28:18.502       address: '2606:4700::6810:22',
13:28:18.502       port: 443
13:28:18.502     },
13:28:18.502     Error: connect ETIMEDOUT 104.16.8.34:443
13:28:18.502         at createConnectionError (node:net:1652:14)
13:28:18.503         at Timeout.internalConnectMultipleTimeout (node:net:1711:38)
13:28:18.503         at listOnTimeout (node:internal/timers:583:11)
13:28:18.503         at process.processTimers (node:internal/timers:519:7) {
13:28:18.503       errno: -110,
13:28:18.503       code: 'ETIMEDOUT',
13:28:18.503       syscall: 'connect',
13:28:18.503       address: '104.16.8.34',
13:28:18.503       port: 443
13:28:18.503     },
13:28:18.503     Error: connect ENETUNREACH 2606:4700::6810:222:443 - Local (:::0)
13:28:18.503         at internalConnectMultiple (node:net:1186:16)
13:28:18.503         at Timeout.internalConnectMultipleTimeout (node:net:1716:5)
13:28:18.503         at listOnTimeout (node:internal/timers:583:11)
13:28:18.503         at process.processTimers (node:internal/timers:519:7) {
13:28:18.503       errno: -101,
13:28:18.503       code: 'ENETUNREACH',
13:28:18.503       syscall: 'connect',
13:28:18.503       address: '2606:4700::6810:222',
13:28:18.503       port: 443
13:28:18.503     }
13:28:18.503   ]
13:28:18.504 }