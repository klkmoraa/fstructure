/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = '0da16d9a0f71';
const PRECACHE = ["./","./assets/CommandPalette-DrZ-YAFg.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DatasheetPanel-gJBeFGBS.js","./assets/DenseResultsSurface-CZV76UGE.js","./assets/DesignSurface-9-F67Ttx.css","./assets/DesignSurface-CqAMPlC0.js","./assets/DxfImportDialog-C1s5H4zw.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-Dgt6TmJL.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-vGiAlHAd.js","./assets/Model2DSurface-DyjCoPGD.css","./assets/Model2DSurface-Z4qcdVbz.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/ModelDoctor-mWmBr4Pc.js","./assets/NewExerciseDialog-8eNxNaEN.js","./assets/NewExerciseDialog-S7BBBLxe.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-CrRCjO3D.js","./assets/PortableImportCenter-CqRsPFA6.js","./assets/ResultExtremeCard-hfKA6sNZ.js","./assets/RevisionComparisonPanel-ClwJN9F-.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/SectionBuilder-CYM_rIls.js","./assets/ShellToolSlots-DdTAG-s7.js","./assets/Space3DDefineDialogs-Bl978279.js","./assets/Space3DDynamicsDialog-CPmVnF65.js","./assets/Space3DSurface-5pXSNQJf.css","./assets/Space3DSurface-XX8HP3qD.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-GHxoTnJn.js","./assets/StructureGeneratorSurface-ClONZ6pa.js","./assets/ToolShell-BssWy-9j.css","./assets/ToolShell-C7WXAhvf.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-BxGe_BdC.js","./assets/WorkspaceShell-DremitPz.css","./assets/analysis.worker-beLaJjLs.js","./assets/appVersion-CkWiFJON.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-C1Jprmfn.js","./assets/catalogEn-CQ1Tnpjf.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DMdU7CgY.js","./assets/check-BjfGI028.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-kDP8avb_.js","./assets/commandPalette-B_q7ocYn.js","./assets/commandPalette-DQx9Afa5.css","./assets/controls-DDGNLH5c.js","./assets/defaultProject-DgotYu1Q.js","./assets/designReport-C403App9.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-ZCxghrJe.css","./assets/diagramBands-_pjZR70G.js","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-CqU7teRS.js","./assets/editorLayers-zanUpO2P.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/grid-CMcgDHRy.js","./assets/index-BhzoIWg0.css","./assets/index-DRzD1EqX.js","./assets/influence.worker-C85oJL11.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/mesaChrome-Bew31mBN.css","./assets/mesaChrome-BpWAUXPX.js","./assets/mesaSelection-B8xrt85p.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-CgCJSyGV.js","./assets/modelDoctorDiagnostics-VpbbHfBw.js","./assets/motionFeatures-BOplYIeS.js","./assets/overlays-B-O9ZFJR.js","./assets/pDelta-B8_mLHZ_.js","./assets/parametric.worker-CJC23J5k.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-fSFbTHKY.js","./assets/projectCommand-CZHs_1Li.js","./assets/projectSignature-Bj8f1QAV.js","./assets/react-9ZasmZpi.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/scenarios.worker-DgM3eQcU.js","./assets/sectionGeometry-JD0WF4HJ.js","./assets/shield-check-CvxkErC7.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-ClZAjhxf.js","./assets/space3d.worker-Ci5JlLHx.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-DPKVmRL5.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-D6qEXL7-.js","./assets/standardSections-B0piPV-d.js","./assets/storage-fkxMPhFc.js","./assets/structural-UqrEznOs.js","./assets/structuralBom-DxY8IPoB.js","./assets/structuralEditing-CDw3wSvg.js","./assets/structureGeneration-BWT72wuk.js","./assets/studies.worker-B1_mpFqY.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-CAOwWUjt.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-Q7aWQtjS.js","./assets/units-Bu9sDGHU.js","./assets/units-DNylVOSp.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-B8H4xpCn.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
const CACHE = `fstructure-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
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
