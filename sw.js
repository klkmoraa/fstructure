/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones. La app avisa
 *   «Nueva versión lista» y, si la persona pulsa «Recargar», manda
 *   `SKIP_WAITING`: sólo entonces la versión nueva toma el control.
 */
const VERSION = 'ff56c08ae433';
const PRECACHE = ["./","./assets/CommandPalette-CGWGUVFC.js","./assets/DatasheetPanel-BEy-l_4t.js","./assets/DatasheetPanel-C8DDcvL_.css","./assets/DenseResultsSurface-Dgjb5bAN.js","./assets/DesignSurface-PSVl29TR.js","./assets/DesignSurface-geBiXXKt.css","./assets/DxfImportDialog-avYaGg4E.css","./assets/DxfImportDialog-y4-D9MII.js","./assets/InfluenceLineView-DyWsniEy.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-z6Vq0iHy.js","./assets/Model2DSurface-Crwr_o3_.css","./assets/Model2DSurface-ytYwfvZy.js","./assets/ModelDoctor-BT516Atz.css","./assets/ModelDoctor-Nb9zjmcy.js","./assets/NewExerciseDialog-BRRa0x21.css","./assets/NewExerciseDialog-btjiT0Iq.js","./assets/PersonalLibraryView-BfJt4zVS.css","./assets/PersonalLibraryView-DhAa89Oe.js","./assets/PortableImportCenter-B-Uvf56d.js","./assets/ResultExtremeCard-Pti17s5N.js","./assets/RevisionComparisonPanel-JglaFoUL.css","./assets/RevisionComparisonPanel-ltyUScrq.js","./assets/ShellToolSlots-CB-4F2ah.js","./assets/Space3DDefineDialogs-C3VLDVh4.js","./assets/Space3DDynamicsDialog-C-bUKOCb.js","./assets/Space3DSurface-2pngAq-G.css","./assets/Space3DSurface-D2smBl3S.js","./assets/StructuralBomPanel-DN7TXtSy.css","./assets/StructuralBomPanel-yyN2X0ZB.js","./assets/StructureGeneratorSurface-Dtz5tSUi.css","./assets/StructureGeneratorSurface-piFg0RKj.js","./assets/ToolShell-CO2WZj0X.css","./assets/ToolShell-COPZGcuh.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-B4NCrzoR.js","./assets/WorkspaceShell-goFd0b-2.css","./assets/analysis.worker-_B5HHxYY.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-SAJKnmqJ.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-C9DK_eU1.js","./assets/catalogEn-ChVgdBbK.js","./assets/catalogEn-DwC3pi53.js","./assets/certificate.worker-DtGdQawo.js","./assets/chart-no-axes-combined-BhDXt4Fk.js","./assets/chevron-left-BAVkD22o.js","./assets/circle-question-mark-BoPAFh0x.js","./assets/codec-BVJhdrY_.js","./assets/commandPalette-9X77f7Rs.css","./assets/commandPalette-DdjCWKYg.js","./assets/defaultProject-D40jnLPz.js","./assets/designReport-CxqltIxZ.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-CVd7vNU3.css","./assets/diagramBands-D5grIvet.js","./assets/disclosure-CBQGjs8l.js","./assets/download-DkJ4a82X.js","./assets/editor-CDlA1CET.js","./assets/editorLayers-BXCD-Tn4.js","./assets/editorLayers-CahOhN5a.css","./assets/en-analysis-DvLdPiL9.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/frameDesign.worker-BlMHBeZ2.js","./assets/grid-DNaEKThz.js","./assets/index-6WVOOssZ.css","./assets/index-CGMb-KC_.js","./assets/influence.worker-DQFyjabO.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/linearModelOperations-BupUj0zC.js","./assets/loader-circle-D08eVkie.js","./assets/memberCurve-G5UKrgRo.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-BH4Q37nW.js","./assets/mesaChrome-xCMCm-TJ.css","./assets/mesaSelection-meHBsXIb.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-C6Yjy2Uu.js","./assets/modelDoctorDiagnostics-BZsA-Jla.js","./assets/modelResult.worker-CMEcVRHP.js","./assets/motionFeatures-DuZmvXtO.js","./assets/overlays-XmCXJU0E.js","./assets/pDelta-dKEq6ebl.js","./assets/parametric.worker-BqyOv3y9.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-vIwtCbvZ.js","./assets/projectCommand-XwVGDnE_.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-C1pfl-O4.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-cYPiH5DB.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-B2KecnEk.js","./assets/solver-Dt8B0ZoY.js","./assets/space3d.worker-CQqaPqzS.js","./assets/space3dAssign-rTiAYbwI.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-W-CQD5Y4.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-BO4FYPS-.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-DsXyWiin.js","./assets/structuralEditing-Bzh5Yzj3.js","./assets/structureGeneration-BsOE2GDX.js","./assets/studies.worker-D4aqjacB.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-DENDjDrQ.js","./assets/unifiedProjectSession-BvRU2X_7.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-DoykoPLa.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
const CACHE = `fstructure-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('fstructure-') && key !== CACHE).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

const sameOrigin = (url) => url.origin === self.location.origin;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!sameOrigin(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put('./', copy));
      }
      return response;
    }).catch(() => caches.match('./', { cacheName: CACHE }).then((cached) => cached ?? Response.error())));
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })));
    return;
  }

  // Íconos y manifiestos: lo guardado al instante y la red lo renueva por detrás.
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(request).then((cached) => {
    const network = fetch(request).then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    }).catch(() => cached ?? Response.error());
    return cached ?? network;
  })));
});
