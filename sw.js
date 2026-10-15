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
const VERSION = '0220903680b7';
const PRECACHE = ["./","./assets/CommandPalette-BfV5iCRn.js","./assets/DatasheetPanel-Cm1FJ6Ux.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-bVA6RrzP.js","./assets/DesignSurface-CHo5GxME.js","./assets/DesignSurface-D9ejDwm2.css","./assets/DxfImportDialog-BqrEpg8W.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-DHgUjAy2.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-Bo74q-XM.js","./assets/Model2DSurface-BosYu1fG.js","./assets/Model2DSurface-CM-lQGtI.css","./assets/ModelDoctor-CH-6YJkp.css","./assets/ModelDoctor-T6CEkTTn.js","./assets/NewExerciseDialog-CZBxz-zR.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-EC5rUc_k.js","./assets/PortableImportCenter-DWHP1BzD.js","./assets/ResultExtremeCard-CySYm4P_.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/RevisionComparisonPanel-pP4A4HHT.js","./assets/ShellToolSlots-DCXN8cuM.js","./assets/Space3DDefineDialogs-BVqPTvZf.js","./assets/Space3DDynamicsDialog-BWKg8IoG.js","./assets/Space3DSurface-BD4yb6Sy.js","./assets/Space3DSurface-DR2I_LWO.css","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-6MDFxrne.js","./assets/StructureGeneratorSurface-BxiFQb_S.js","./assets/ToolShell-BB0E4su0.css","./assets/ToolShell-DQRyaAE4.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-BJJPISp_.js","./assets/WorkspaceShell-DLD35cZz.css","./assets/analysis.worker-B2FAc8ft.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-BhRzFoon.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-yZNDvUTY.js","./assets/catalogEn-De1A6AuZ.js","./assets/catalogEn-ORg0gwW3.js","./assets/certificate.worker-DtMmOleM.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-LX_uwK3m.js","./assets/commandPalette-C0jpoMBd.js","./assets/commandPalette-DQx9Afa5.css","./assets/defaultProject-DgVyu8JU.js","./assets/designReport-D4GpvyxX.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-ClJpU2q7.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-B_noPuU-.js","./assets/download-DkJ4a82X.js","./assets/editor-BkhLItGE.js","./assets/editorLayers-CwbcVRej.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-CMcgDHRy.js","./assets/index-DJGFN54g.js","./assets/index-J62Mhu7-.css","./assets/influence.worker-fQgTOG-K.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-C_htGbWX.css","./assets/mesaChrome-CrLWe0F4.js","./assets/mesaSelection-C7V28j63.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-BdLbRMPF.js","./assets/modelDoctorDiagnostics-DvLKl8OD.js","./assets/modelResult.worker-Du8qsbPX.js","./assets/motionFeatures-oFgr-ny0.js","./assets/overlays-Dl9-TPZ0.js","./assets/pDelta-CrJwla6P.js","./assets/parametric.worker-vW6zyirt.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-Dqqw6AYU.js","./assets/projectCommand-DzPDM0gF.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-CqIbKHMO.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-LOsj-tPm.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/solver-CM6Qgfzu.js","./assets/space3d.worker-5HTJ40nX.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-BcluVpHO.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-D1j9iFVQ.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-DkUuUW-l.js","./assets/structuralEditing-Ik2LLuB2.js","./assets/structureGeneration-DEFZOsw8.js","./assets/studies.worker-0HuPKxYN.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-CfJ6HF0A.js","./assets/unifiedProjectSession-CiSFMjvm.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-BSp0TmPj.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
