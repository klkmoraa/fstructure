/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = '54c3b02e8b13';
const PRECACHE = ["./","./assets/CommandPalette-5HoMei6T.js","./assets/DatasheetPanel-BZO92BO4.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-3gTrJdcG.js","./assets/DesignSurface-BjVt3Wza.js","./assets/DesignSurface-D-TQ-MV1.css","./assets/DxfImportDialog-DYHKgan7.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-DI7mTyhp.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-BrQQAnU2.js","./assets/Model2DSurface-DyjCoPGD.css","./assets/Model2DSurface-gCFWb22Z.js","./assets/ModelDoctor-99HTEoTA.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/NewExerciseDialog-CZu6mDWO.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-C0MDG1Ns.js","./assets/PortableImportCenter-pvMFR12m.js","./assets/ResultExtremeCard-B72MgGX7.js","./assets/RevisionComparisonPanel-D84sjBew.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/SectionBuilder-EdGEO82r.js","./assets/ShellToolSlots-DFU2yyLV.js","./assets/Space3DDefineDialogs-BLEEuozR.js","./assets/Space3DDynamicsDialog-CULLRA6R.js","./assets/Space3DSurface-5pXSNQJf.css","./assets/Space3DSurface-CkLEyFKS.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-CeFDQ5oT.js","./assets/StructureGeneratorSurface-uKBbIkSz.js","./assets/ToolShell-BssWy-9j.css","./assets/ToolShell-C0yxYmCj.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-DVAJydKW.css","./assets/WorkspaceShell-Dm8RfgRG.js","./assets/analysis.worker-beLaJjLs.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-WUHDSj8f.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-Chhs7cJj.js","./assets/catalogEn-DMw7O8Rv.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DMdU7CgY.js","./assets/check-BjfGI028.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-kDP8avb_.js","./assets/commandPalette-3WDmkUMa.js","./assets/commandPalette-DQx9Afa5.css","./assets/controls-DDGNLH5c.js","./assets/defaultProject-ClDHAwHl.js","./assets/designReport-A5Kf8bIO.js","./assets/designWorkbenchCodec-BiwOJjy8.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-ZCxghrJe.css","./assets/diagramBands-pZwFBxoS.js","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-UcsczSRL.js","./assets/editorLayers-DcmfkBAX.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-CMcgDHRy.js","./assets/index-BhzoIWg0.css","./assets/index-QwwWYiCN.js","./assets/influence.worker-C85oJL11.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/mesaChrome-Bew31mBN.css","./assets/mesaChrome-DDONJg3U.js","./assets/mesaSelection-iMrEpwki.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-CgCJSyGV.js","./assets/modelDoctorDiagnostics-0RNd_liW.js","./assets/modelResult.worker-3r-IXyue.js","./assets/motionFeatures-BVLf-T-0.js","./assets/overlays-C7uN2RLi.js","./assets/pDelta-OvGoAerQ.js","./assets/parametric.worker-CJC23J5k.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-C2TCWEnK.js","./assets/projectCommand-CrCvndpZ.js","./assets/projectSignature-Bj8f1QAV.js","./assets/react-9ZasmZpi.js","./assets/reinforcementAlternatives.worker-JNAryuaN.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-DgM3eQcU.js","./assets/sectionGeometry-JD0WF4HJ.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-Bw-wJ2SF.js","./assets/space3d.worker-Ci5JlLHx.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-B1fybw8l.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-B0piPV-d.js","./assets/storage-fkxMPhFc.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-CbZCbZ_Q.js","./assets/structuralEditing-BY6qdJ4f.js","./assets/structureGeneration-dujsyba1.js","./assets/studies.worker-B1_mpFqY.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-CEzZZN0H.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-Rz8GQEi-.js","./assets/units-Bu9sDGHU.js","./assets/units-DNylVOSp.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-BrbDVQL_.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
