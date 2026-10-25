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
const VERSION = '2c4f8cc43160';
const PRECACHE = ["./","./assets/CommandPalette-B2J97QAL.js","./assets/DatasheetPanel-QrdJMgFa.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-AX2ZWOaV.js","./assets/DesignSurface-C8ZzwVk7.css","./assets/DesignSurface-DkcIWPhg.js","./assets/DxfImportDialog-BdaLS3lj.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-rw_LI6Cd.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-Pglc1kHF.js","./assets/Model2DSurface-CPFi4JPv.js","./assets/Model2DSurface-CZrnBEDr.css","./assets/ModelDoctor-CH-6YJkp.css","./assets/ModelDoctor-CofZcI09.js","./assets/NewExerciseDialog-Dp7J4x59.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-Co8rfDpM.js","./assets/PortableImportCenter-C6urSDbt.js","./assets/ResultExtremeCard-BBhGj8Yq.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/RevisionComparisonPanel-J3Yqpqj9.js","./assets/ShellToolSlots-CY0nWF3s.js","./assets/Space3DDefineDialogs-DDEC6E3P.js","./assets/Space3DDynamicsDialog-kpoB2HLx.js","./assets/Space3DSurface-D9UVd3f0.css","./assets/Space3DSurface-DbD9DElc.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-C2JhcIIv.js","./assets/StructureGeneratorSurface-Cdg9l6dq.js","./assets/ToolShell-BB0E4su0.css","./assets/ToolShell-BszrSiGj.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell--sxyBXXE.css","./assets/WorkspaceShell-TUQ5O4hY.js","./assets/analysis.worker-8LTbF5kV.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-Coa3aC8H.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-CfD7VJmJ.js","./assets/catalogEn-CU6Dh-pb.js","./assets/catalogEn-HfOxidB3.js","./assets/certificate.worker-BaDH1qwV.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-BVJhdrY_.js","./assets/commandPalette-BUuk3S7Q.js","./assets/commandPalette-DQx9Afa5.css","./assets/defaultProject-CMsMiDz2.js","./assets/designReport-BcFKby7p.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-DGP7TTZb.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DPp3Yqmk.js","./assets/download-DkJ4a82X.js","./assets/editor-DyIIIxoE.js","./assets/editorLayers-Bxji3nLu.js","./assets/editorLayers-CahOhN5a.css","./assets/en-analysis-DvLdPiL9.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/frameDesign.worker-_QBcOq00.js","./assets/grid-DNaEKThz.js","./assets/index-Dztmyx0n.css","./assets/index-TNb8sDnV.js","./assets/influence.worker-CCviiOsE.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-D57FNE8K.css","./assets/mesaChrome-w3wP1nkc.js","./assets/mesaSelection-C8v4DpqI.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-DCXZmfeB.js","./assets/modelDoctorDiagnostics-Dk4WSXlS.js","./assets/modelResult.worker-CAKBpXFt.js","./assets/motionFeatures-BOtpY8na.js","./assets/overlays-sj-pqwAr.js","./assets/pDelta-DfF8XQYv.js","./assets/parametric.worker-MCmlFyRX.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-C6CQ7sxX.js","./assets/projectCommand-6i7BcMRi.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-CE-65f9l.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-BWBLxQaT.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/solver-BNiFOz6J.js","./assets/space3d.worker-CQqaPqzS.js","./assets/space3dAssign-rTiAYbwI.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-Cq3tSzCp.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-BO4FYPS-.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-mM-NrErZ.js","./assets/structuralEditing-D8Uq_vOP.js","./assets/structureGeneration-B0LXUzJJ.js","./assets/studies.worker-D-jSN4Jo.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-DZAN-VY_.js","./assets/unifiedProjectSession-DOydgD3P.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-G0t-RBRQ.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
