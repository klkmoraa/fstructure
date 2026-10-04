import{t as e}from"./rolldown-runtime-CNC7AqOf.js";import{t}from"./react-9ZasmZpi.js";import{gi as n,mt as r}from"./index-D-yGrGqC.js";import{PDFDocument as i,StandardFonts as a,concatTransformationMatrix as o,popGraphicsState as s,pushGraphicsState as c,rgb as l}from"./es-CEbGEA7n.js";import{C as u,i as d,n as f,o as p,r as m}from"./designReport-BclArkkp.js";import{r as h,t as g}from"./pdfBuilder-CyY8jyMr.js";var _=e((e=>{var r=t(),i=n();function a(e){var t=`https://react.dev/errors/`+e;if(1<arguments.length){t+=`?args[]=`+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+=`&args[]=`+encodeURIComponent(arguments[n])}return`Minified React error #`+e+`; visit `+t+` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`}var o=Symbol.for(`react.transitional.element`),s=Symbol.for(`react.portal`),c=Symbol.for(`react.fragment`),l=Symbol.for(`react.strict_mode`),u=Symbol.for(`react.profiler`),d=Symbol.for(`react.consumer`),f=Symbol.for(`react.context`),p=Symbol.for(`react.forward_ref`),m=Symbol.for(`react.suspense`),h=Symbol.for(`react.suspense_list`),g=Symbol.for(`react.memo`),_=Symbol.for(`react.lazy`),v=Symbol.for(`react.scope`),y=Symbol.for(`react.activity`),b=Symbol.for(`react.legacy_hidden`),x=Symbol.for(`react.memo_cache_sentinel`),S=Symbol.for(`react.view_transition`),C=Symbol.iterator;function ee(e){return typeof e!=`object`||!e?null:(e=C&&e[C]||e[`@@iterator`],typeof e==`function`?e:null)}var w=Array.isArray;function T(e,t){var n=e.length&3,r=e.length-n,i=t;for(t=0;t<r;){var a=e.charCodeAt(t)&255|(e.charCodeAt(++t)&255)<<8|(e.charCodeAt(++t)&255)<<16|(e.charCodeAt(++t)&255)<<24;++t,a=3432918353*(a&65535)+((3432918353*(a>>>16)&65535)<<16)&4294967295,a=a<<15|a>>>17,a=461845907*(a&65535)+((461845907*(a>>>16)&65535)<<16)&4294967295,i^=a,i=i<<13|i>>>19,i=5*(i&65535)+((5*(i>>>16)&65535)<<16)&4294967295,i=(i&65535)+27492+(((i>>>16)+58964&65535)<<16)}switch(a=0,n){case 3:a^=(e.charCodeAt(t+2)&255)<<16;case 2:a^=(e.charCodeAt(t+1)&255)<<8;case 1:a^=e.charCodeAt(t)&255,a=3432918353*(a&65535)+((3432918353*(a>>>16)&65535)<<16)&4294967295,a=a<<15|a>>>17,i^=461845907*(a&65535)+((461845907*(a>>>16)&65535)<<16)&4294967295}return i^=e.length,i^=i>>>16,i=2246822507*(i&65535)+((2246822507*(i>>>16)&65535)<<16)&4294967295,i^=i>>>13,i=3266489909*(i&65535)+((3266489909*(i>>>16)&65535)<<16)&4294967295,(i^i>>>16)>>>0}var E=Object.assign,D=Object.prototype.hasOwnProperty,O=RegExp(`^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$`),k={},A={};function j(e){return D.call(A,e)?!0:D.call(k,e)?!1:O.test(e)?A[e]=!0:(k[e]=!0,!1)}var M=new Set(`animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp`.split(` `)),N=new Map([[`acceptCharset`,`accept-charset`],[`htmlFor`,`for`],[`httpEquiv`,`http-equiv`],[`crossOrigin`,`crossorigin`],[`accentHeight`,`accent-height`],[`alignmentBaseline`,`alignment-baseline`],[`arabicForm`,`arabic-form`],[`baselineShift`,`baseline-shift`],[`capHeight`,`cap-height`],[`clipPath`,`clip-path`],[`clipRule`,`clip-rule`],[`colorInterpolation`,`color-interpolation`],[`colorInterpolationFilters`,`color-interpolation-filters`],[`colorProfile`,`color-profile`],[`colorRendering`,`color-rendering`],[`dominantBaseline`,`dominant-baseline`],[`enableBackground`,`enable-background`],[`fillOpacity`,`fill-opacity`],[`fillRule`,`fill-rule`],[`floodColor`,`flood-color`],[`floodOpacity`,`flood-opacity`],[`fontFamily`,`font-family`],[`fontSize`,`font-size`],[`fontSizeAdjust`,`font-size-adjust`],[`fontStretch`,`font-stretch`],[`fontStyle`,`font-style`],[`fontVariant`,`font-variant`],[`fontWeight`,`font-weight`],[`glyphName`,`glyph-name`],[`glyphOrientationHorizontal`,`glyph-orientation-horizontal`],[`glyphOrientationVertical`,`glyph-orientation-vertical`],[`horizAdvX`,`horiz-adv-x`],[`horizOriginX`,`horiz-origin-x`],[`imageRendering`,`image-rendering`],[`letterSpacing`,`letter-spacing`],[`lightingColor`,`lighting-color`],[`markerEnd`,`marker-end`],[`markerMid`,`marker-mid`],[`markerStart`,`marker-start`],[`overlinePosition`,`overline-position`],[`overlineThickness`,`overline-thickness`],[`paintOrder`,`paint-order`],[`panose-1`,`panose-1`],[`pointerEvents`,`pointer-events`],[`renderingIntent`,`rendering-intent`],[`shapeRendering`,`shape-rendering`],[`stopColor`,`stop-color`],[`stopOpacity`,`stop-opacity`],[`strikethroughPosition`,`strikethrough-position`],[`strikethroughThickness`,`strikethrough-thickness`],[`strokeDasharray`,`stroke-dasharray`],[`strokeDashoffset`,`stroke-dashoffset`],[`strokeLinecap`,`stroke-linecap`],[`strokeLinejoin`,`stroke-linejoin`],[`strokeMiterlimit`,`stroke-miterlimit`],[`strokeOpacity`,`stroke-opacity`],[`strokeWidth`,`stroke-width`],[`textAnchor`,`text-anchor`],[`textDecoration`,`text-decoration`],[`textRendering`,`text-rendering`],[`transformOrigin`,`transform-origin`],[`underlinePosition`,`underline-position`],[`underlineThickness`,`underline-thickness`],[`unicodeBidi`,`unicode-bidi`],[`unicodeRange`,`unicode-range`],[`unitsPerEm`,`units-per-em`],[`vAlphabetic`,`v-alphabetic`],[`vHanging`,`v-hanging`],[`vIdeographic`,`v-ideographic`],[`vMathematical`,`v-mathematical`],[`vectorEffect`,`vector-effect`],[`vertAdvY`,`vert-adv-y`],[`vertOriginX`,`vert-origin-x`],[`vertOriginY`,`vert-origin-y`],[`wordSpacing`,`word-spacing`],[`writingMode`,`writing-mode`],[`xmlnsXlink`,`xmlns:xlink`],[`xHeight`,`x-height`]]),P=/["'&<>]/;function F(e){if(typeof e==`boolean`||typeof e==`number`||typeof e==`bigint`)return``+e;e=``+e;var t=P.exec(e);if(t){var n=``,r,i=0;for(r=t.index;r<e.length;r++){switch(e.charCodeAt(r)){case 34:t=`&quot;`;break;case 38:t=`&amp;`;break;case 39:t=`&#x27;`;break;case 60:t=`&lt;`;break;case 62:t=`&gt;`;break;default:continue}i!==r&&(n+=e.slice(i,r)),i=r+1,n+=t}e=i===r?n:n+e.slice(i,r)}return e}var te=/([A-Z])/g,ne=/^ms-/,I=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function L(e){return I.test(``+e)?`javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')`:e}var re=r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,ie=i.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,R={pending:!1,data:null,method:null,action:null},z=ie.d;ie.d={f:z.f,r:z.r,D:rt,C:it,L:at,m:ot,X:ct,S:st,M:lt};var ae=[],oe=null,se=/(<\/|<)(s)(cript)/gi;function ce(e,t,n,r){return``+t+(n===`s`?`\\u0073`:`\\u0053`)+r}function le(e,t,n,r,i){return{idPrefix:e===void 0?``:e,nextFormID:0,streamingFormat:0,bootstrapScriptContent:n,bootstrapScripts:r,bootstrapModules:i,instructions:0,hasBody:!1,hasHtml:!1,unknownResources:{},dnsResources:{},connectResources:{default:{},anonymous:{},credentials:{}},imageResources:{},styleResources:{},scriptResources:{},moduleUnknownResources:{},moduleScriptResources:{}}}function B(e,t,n,r){return{insertionMode:e,selectedValue:t,tagScope:n,viewTransition:r}}function ue(e,t,n){var r=e.tagScope&-25;switch(t){case`noscript`:return B(2,null,r|1,null);case`select`:return B(2,n.value==null?n.defaultValue:n.value,r,null);case`svg`:return B(4,null,r,null);case`picture`:return B(2,null,r|2,null);case`math`:return B(5,null,r,null);case`foreignObject`:return B(2,null,r,null);case`table`:return B(6,null,r,null);case`thead`:case`tbody`:case`tfoot`:return B(7,null,r,null);case`colgroup`:return B(9,null,r,null);case`tr`:return B(8,null,r,null);case`head`:if(2>e.insertionMode)return B(3,null,r,null);break;case`html`:if(e.insertionMode===0)return B(1,null,r,null)}return 6<=e.insertionMode||2>e.insertionMode?B(2,null,r,null):e.tagScope===r?e:B(e.insertionMode,e.selectedValue,r,null)}function V(e){return e===null?null:{update:e.update,enter:`none`,exit:`none`,share:e.update,name:e.autoName,autoName:e.autoName,nameIdx:0}}function de(e,t){return t.tagScope&32&&(e.instructions|=128),B(t.insertionMode,t.selectedValue,t.tagScope|12,V(t.viewTransition))}function fe(e,t){e=V(t.viewTransition);var n=t.tagScope|16;return e!==null&&e.share!==`none`&&(n|=64),B(t.insertionMode,t.selectedValue,n,e)}var pe=new Map;function me(e,t){if(typeof t!=`object`)throw Error(a(62));var n=!0,r;for(r in t)if(D.call(t,r)){var i=t[r];if(i!=null&&typeof i!=`boolean`&&i!==``){if(r.indexOf(`--`)===0){var o=F(r);i=F((``+i).trim())}else o=pe.get(r),o===void 0&&(o=F(r.replace(te,`-$1`).toLowerCase().replace(ne,`-ms-`)),pe.set(r,o)),i=typeof i==`number`?i===0||M.has(r)?``+i:i+`px`:F((``+i).trim());n?(n=!1,e.push(` style="`,o,`:`,i)):e.push(`;`,o,`:`,i)}}n||e.push(`"`)}function he(e,t,n){n&&typeof n!=`function`&&typeof n!=`symbol`&&e.push(` `,t,`=""`)}function ge(e,t,n){typeof n!=`function`&&typeof n!=`symbol`&&typeof n!=`boolean`&&e.push(` `,t,`="`,F(n),`"`)}var _e=F(`javascript:throw new Error('React form unexpectedly submitted.')`);function ve(e,t){this.push(`<input type="hidden"`),ye(e),ge(this,`name`,t),ge(this,`value`,e),this.push(`/>`)}function ye(e){if(typeof e!=`string`)throw Error(a(480))}function be(e,t){if(typeof t.$$FORM_ACTION==`function`){var n=e.nextFormID++;e=e.idPrefix+n;try{var r=t.$$FORM_ACTION(e);return r&&r.data?.forEach(ye),r}catch(e){if(typeof e==`object`&&e&&typeof e.then==`function`)throw e}}return null}function xe(e,t,n,r,i,a,o,s){var c=null;if(typeof r==`function`){var l=be(t,r);l===null?(e.push(` `,`formAction`,`="`,_e,`"`),o=a=i=r=s=null,we(t,n)):(s=l.name,r=l.action||``,i=l.encType,a=l.method,o=l.target,c=l.data)}return s!=null&&H(e,`name`,s),r!=null&&H(e,`formAction`,r),i!=null&&H(e,`formEncType`,i),a!=null&&H(e,`formMethod`,a),o!=null&&H(e,`formTarget`,o),c}function H(e,t,n){switch(t){case`className`:ge(e,`class`,n);break;case`tabIndex`:ge(e,`tabindex`,n);break;case`dir`:case`role`:case`viewBox`:case`width`:case`height`:ge(e,t,n);break;case`style`:me(e,n);break;case`src`:case`href`:if(n===``)break;case`action`:case`formAction`:if(n==null||typeof n==`function`||typeof n==`symbol`||typeof n==`boolean`)break;n=L(``+n),e.push(` `,t,`="`,F(n),`"`);break;case`defaultValue`:case`defaultChecked`:case`innerHTML`:case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`ref`:break;case`autoFocus`:case`multiple`:case`muted`:he(e,t.toLowerCase(),n);break;case`xlinkHref`:if(typeof n==`function`||typeof n==`symbol`||typeof n==`boolean`)break;n=L(``+n),e.push(` `,`xlink:href`,`="`,F(n),`"`);break;case`contentEditable`:case`spellCheck`:case`draggable`:case`value`:case`autoReverse`:case`externalResourcesRequired`:case`focusable`:case`preserveAlpha`:typeof n!=`function`&&typeof n!=`symbol`&&e.push(` `,t,`="`,F(n),`"`);break;case`inert`:case`allowFullScreen`:case`async`:case`autoPlay`:case`controls`:case`default`:case`defer`:case`disabled`:case`disablePictureInPicture`:case`disableRemotePlayback`:case`formNoValidate`:case`hidden`:case`loop`:case`noModule`:case`noValidate`:case`open`:case`playsInline`:case`readOnly`:case`required`:case`reversed`:case`scoped`:case`seamless`:case`itemScope`:n&&typeof n!=`function`&&typeof n!=`symbol`&&e.push(` `,t,`=""`);break;case`capture`:case`download`:!0===n?e.push(` `,t,`=""`):!1!==n&&typeof n!=`function`&&typeof n!=`symbol`&&e.push(` `,t,`="`,F(n),`"`);break;case`cols`:case`rows`:case`size`:case`span`:typeof n!=`function`&&typeof n!=`symbol`&&!isNaN(n)&&1<=n&&e.push(` `,t,`="`,F(n),`"`);break;case`rowSpan`:case`start`:typeof n==`function`||typeof n==`symbol`||isNaN(n)||e.push(` `,t,`="`,F(n),`"`);break;case`xlinkActuate`:ge(e,`xlink:actuate`,n);break;case`xlinkArcrole`:ge(e,`xlink:arcrole`,n);break;case`xlinkRole`:ge(e,`xlink:role`,n);break;case`xlinkShow`:ge(e,`xlink:show`,n);break;case`xlinkTitle`:ge(e,`xlink:title`,n);break;case`xlinkType`:ge(e,`xlink:type`,n);break;case`xmlBase`:ge(e,`xml:base`,n);break;case`xmlLang`:ge(e,`xml:lang`,n);break;case`xmlSpace`:ge(e,`xml:space`,n);break;default:if((!(2<t.length)||t[0]!==`o`&&t[0]!==`O`||t[1]!==`n`&&t[1]!==`N`)&&(t=N.get(t)||t,j(t))){switch(typeof n){case`function`:case`symbol`:return;case`boolean`:var r=t.toLowerCase().slice(0,5);if(r!==`data-`&&r!==`aria-`)return}e.push(` `,t,`="`,F(n),`"`)}}}function Se(e,t,n){if(t!=null){if(n!=null)throw Error(a(60));if(typeof t!=`object`||!(`__html`in t))throw Error(a(61));t=t.__html,t!=null&&e.push(``+t)}}function Ce(e){var t=``;return r.Children.forEach(e,function(e){e!=null&&(t+=e)}),t}function we(e,t){if(!(e.instructions&16)){e.instructions|=16;var n=t.preamble,r=t.bootstrapChunks;(n.htmlChunks||n.headChunks)&&r.length===0?(r.push(t.startInlineScript),tt(r,e),r.push(`>`,`addEventListener("submit",function(a){if(!a.defaultPrevented){var c=a.target,d=a.submitter,e=c.action,b=d;if(d){var f=d.getAttribute("formAction");null!=f&&(e=f,b=null)}"javascript:throw new Error('React form unexpectedly submitted.')"===e&&(a.preventDefault(),b?(a=document.createElement("input"),a.name=b.name,a.value=b.value,b.parentNode.insertBefore(a,b),b=new FormData(c),a.parentNode.removeChild(a)):b=new FormData(c),a=c.ownerDocument||c,(a.$$reactFormReplay=a.$$reactFormReplay||[]).push(c,d,b))}});`,`<\/script>`)):r.unshift(t.startInlineScript,`>`,`addEventListener("submit",function(a){if(!a.defaultPrevented){var c=a.target,d=a.submitter,e=c.action,b=d;if(d){var f=d.getAttribute("formAction");null!=f&&(e=f,b=null)}"javascript:throw new Error('React form unexpectedly submitted.')"===e&&(a.preventDefault(),b?(a=document.createElement("input"),a.name=b.name,a.value=b.value,b.parentNode.insertBefore(a,b),b=new FormData(c),a.parentNode.removeChild(a)):b=new FormData(c),a=c.ownerDocument||c,(a.$$reactFormReplay=a.$$reactFormReplay||[]).push(c,d,b))}});`,`<\/script>`)}}function Te(e,t){for(var n in e.push(U(`link`)),t)if(D.call(t,n)){var r=t[n];if(r!=null)switch(n){case`children`:case`dangerouslySetInnerHTML`:throw Error(a(399,`link`));default:H(e,n,r)}}return e.push(`/>`),null}var Ee=/(<\/|<)(s)(tyle)/gi;function De(e,t,n,r){return``+t+(n===`s`?`\\73 `:`\\53 `)+r}function Oe(e,t,n){for(var r in e.push(U(n)),t)if(D.call(t,r)){var i=t[r];if(i!=null)switch(r){case`children`:case`dangerouslySetInnerHTML`:throw Error(a(399,n));default:H(e,r,i)}}return e.push(`/>`),null}function ke(e,t){e.push(U(`title`));var n=null,r=null,i;for(i in t)if(D.call(t,i)){var a=t[i];if(a!=null)switch(i){case`children`:n=a;break;case`dangerouslySetInnerHTML`:r=a;break;default:H(e,i,a)}}return e.push(`>`),t=Array.isArray(n)?2>n.length?n[0]:null:n,typeof t!=`function`&&typeof t!=`symbol`&&t!=null&&e.push(F(``+t)),Se(e,r,n),e.push(Ie(`title`)),null}function Ae(e,t){e.push(U(`script`));var n=null,r=null,i;for(i in t)if(D.call(t,i)){var a=t[i];if(a!=null)switch(i){case`children`:n=a;break;case`dangerouslySetInnerHTML`:r=a;break;default:H(e,i,a)}}return e.push(`>`),Se(e,r,n),typeof n==`string`&&e.push((``+n).replace(se,ce)),e.push(Ie(`script`)),null}function je(e,t,n){e.push(U(n));var r=n=null,i;for(i in t)if(D.call(t,i)){var a=t[i];if(a!=null)switch(i){case`children`:n=a;break;case`dangerouslySetInnerHTML`:r=a;break;default:H(e,i,a)}}return e.push(`>`),Se(e,r,n),n}function Me(e,t,n){e.push(U(n));var r=n=null,i;for(i in t)if(D.call(t,i)){var a=t[i];if(a!=null)switch(i){case`children`:n=a;break;case`dangerouslySetInnerHTML`:r=a;break;default:H(e,i,a)}}return e.push(`>`),Se(e,r,n),typeof n==`string`?(e.push(F(n)),null):n}var Ne=/^[a-zA-Z][a-zA-Z:_\.\-\d]*$/,Pe=new Map;function U(e){var t=Pe.get(e);if(t===void 0){if(!Ne.test(e))throw Error(a(65,e));t=`<`+e,Pe.set(e,t)}return t}function W(e,t,n,r,i,o,s,c,l){switch(t){case`div`:case`span`:case`svg`:case`path`:break;case`a`:e.push(U(`a`));var u=null,d=null,f;for(f in n)if(D.call(n,f)){var p=n[f];if(p!=null)switch(f){case`children`:u=p;break;case`dangerouslySetInnerHTML`:d=p;break;case`href`:p===``?ge(e,`href`,``):H(e,f,p);break;default:H(e,f,p)}}if(e.push(`>`),Se(e,d,u),typeof u==`string`){e.push(F(u));var m=null}else m=u;return m;case`g`:case`p`:case`li`:break;case`select`:e.push(U(`select`));var h=null,g=null,_;for(_ in n)if(D.call(n,_)){var v=n[_];if(v!=null)switch(_){case`children`:h=v;break;case`dangerouslySetInnerHTML`:g=v;break;case`defaultValue`:case`value`:break;default:H(e,_,v)}}return e.push(`>`),Se(e,g,h),h;case`option`:var y=c.selectedValue;e.push(U(`option`));var b=null,x=null,S=null,C=null,ee;for(ee in n)if(D.call(n,ee)){var T=n[ee];if(T!=null)switch(ee){case`children`:b=T;break;case`selected`:S=T;break;case`dangerouslySetInnerHTML`:C=T;break;case`value`:x=T;default:H(e,ee,T)}}if(y!=null){var O=x===null?Ce(b):``+x;if(w(y)){for(var k=0;k<y.length;k++)if(``+y[k]===O){e.push(` selected=""`);break}}else``+y===O&&e.push(` selected=""`)}else S&&e.push(` selected=""`);return e.push(`>`),Se(e,C,b),b;case`textarea`:e.push(U(`textarea`));var A=null,M=null,N=null,P;for(P in n)if(D.call(n,P)){var te=n[P];if(te!=null)switch(P){case`children`:N=te;break;case`value`:A=te;break;case`defaultValue`:M=te;break;case`dangerouslySetInnerHTML`:throw Error(a(91));default:H(e,P,te)}}if(A===null&&M!==null&&(A=M),e.push(`>`),N!=null){if(A!=null)throw Error(a(92));if(w(N)){if(1<N.length)throw Error(a(93));A=``+N[0]}A=``+N}return typeof A==`string`&&A[0]===`
`&&e.push(`
`),A!==null&&e.push(F(``+A)),null;case`input`:e.push(U(`input`));var ne=null,I=null,re=null,ie=null,R=null,z=null,oe=null,se=null,ce=null,le;for(le in n)if(D.call(n,le)){var B=n[le];if(B!=null)switch(le){case`children`:case`dangerouslySetInnerHTML`:throw Error(a(399,`input`));case`name`:ne=B;break;case`formAction`:I=B;break;case`formEncType`:re=B;break;case`formMethod`:ie=B;break;case`formTarget`:R=B;break;case`defaultChecked`:ce=B;break;case`defaultValue`:oe=B;break;case`checked`:se=B;break;case`value`:z=B;break;default:H(e,le,B)}}var ue=xe(e,r,i,I,re,ie,R,ne);return se===null?ce!==null&&he(e,`checked`,ce):he(e,`checked`,se),z===null?oe!==null&&H(e,`value`,oe):H(e,`value`,z),e.push(`/>`),ue?.forEach(ve,e),null;case`button`:e.push(U(`button`));var V=null,de=null,fe=null,pe=null,ye=null,Ne=null,Pe=null,W;for(W in n)if(D.call(n,W)){var Fe=n[W];if(Fe!=null)switch(W){case`children`:V=Fe;break;case`dangerouslySetInnerHTML`:de=Fe;break;case`name`:fe=Fe;break;case`formAction`:pe=Fe;break;case`formEncType`:ye=Fe;break;case`formMethod`:Ne=Fe;break;case`formTarget`:Pe=Fe;break;default:H(e,W,Fe)}}var Le=xe(e,r,i,pe,ye,Ne,Pe,fe);if(e.push(`>`),Le?.forEach(ve,e),Se(e,de,V),typeof V==`string`){e.push(F(V));var Re=null}else Re=V;return Re;case`form`:e.push(U(`form`));var ze=null,Be=null,Ve=null,He=null,Ue=null,We=null,Ge;for(Ge in n)if(D.call(n,Ge)){var Ke=n[Ge];if(Ke!=null)switch(Ge){case`children`:ze=Ke;break;case`dangerouslySetInnerHTML`:Be=Ke;break;case`action`:Ve=Ke;break;case`encType`:He=Ke;break;case`method`:Ue=Ke;break;case`target`:We=Ke;break;default:H(e,Ge,Ke)}}var qe=null,Je=null;if(typeof Ve==`function`){var G=be(r,Ve);G===null?(e.push(` `,`action`,`="`,_e,`"`),We=Ue=He=Ve=null,we(r,i)):(Ve=G.action||``,He=G.encType,Ue=G.method,We=G.target,qe=G.data,Je=G.name)}if(Ve!=null&&H(e,`action`,Ve),He!=null&&H(e,`encType`,He),Ue!=null&&H(e,`method`,Ue),We!=null&&H(e,`target`,We),e.push(`>`),Je!==null&&(e.push(`<input type="hidden"`),ge(e,`name`,Je),e.push(`/>`),qe?.forEach(ve,e)),Se(e,Be,ze),typeof ze==`string`){e.push(F(ze));var Ye=null}else Ye=ze;return Ye;case`menuitem`:for(var Xe in e.push(U(`menuitem`)),n)if(D.call(n,Xe)){var K=n[Xe];if(K!=null)switch(Xe){case`children`:case`dangerouslySetInnerHTML`:throw Error(a(400));default:H(e,Xe,K)}}return e.push(`>`),null;case`object`:e.push(U(`object`));var Ze=null,Qe=null,$e;for($e in n)if(D.call(n,$e)){var et=n[$e];if(et!=null)switch($e){case`children`:Ze=et;break;case`dangerouslySetInnerHTML`:Qe=et;break;case`data`:var tt=L(``+et);if(tt===``)break;e.push(` `,`data`,`="`,F(tt),`"`);break;default:H(e,$e,et)}}if(e.push(`>`),Se(e,Qe,Ze),typeof Ze==`string`){e.push(F(Ze));var nt=null}else nt=Ze;return nt;case`title`:var q=c.tagScope&1,J=c.tagScope&4;if(c.insertionMode===4||q||n.itemProp!=null)var rt=ke(e,n);else J?rt=null:(ke(i.hoistableChunks,n),rt=void 0);return rt;case`link`:var it=c.tagScope&1,at=c.tagScope&4,ot=n.rel,st=n.href,ct=n.precedence;if(c.insertionMode===4||it||n.itemProp!=null||typeof ot!=`string`||typeof st!=`string`||st===``){Te(e,n);var lt=null}else if(n.rel===`stylesheet`)if(typeof ct!=`string`||n.disabled!=null||n.onLoad||n.onError)lt=Te(e,n);else{var ft=i.styles.get(ct),pt=r.styleResources.hasOwnProperty(st)?r.styleResources[st]:void 0;if(pt!==null){r.styleResources[st]=null,ft||(ft={precedence:F(ct),rules:[],hrefs:[],sheets:new Map},i.styles.set(ct,ft));var mt={state:0,props:E({},n,{"data-precedence":n.precedence,precedence:null})};if(pt){pt.length===2&&ut(mt.props,pt);var ht=i.preloads.stylesheets.get(st);ht&&0<ht.length?ht.length=0:mt.state=1}ft.sheets.set(st,mt),s&&s.stylesheets.add(mt)}else if(ft){var gt=ft.sheets.get(st);gt&&s&&s.stylesheets.add(gt)}l&&e.push(`<!-- -->`),lt=null}else n.onLoad||n.onError?lt=Te(e,n):(l&&e.push(`<!-- -->`),lt=at?null:Te(i.hoistableChunks,n));return lt;case`script`:var _t=c.tagScope&1,vt=n.async;if(typeof n.src!=`string`||!n.src||!vt||typeof vt==`function`||typeof vt==`symbol`||n.onLoad||n.onError||c.insertionMode===4||_t||n.itemProp!=null)var yt=Ae(e,n);else{var bt=n.src;if(n.type===`module`)var xt=r.moduleScriptResources,St=i.preloads.moduleScripts;else xt=r.scriptResources,St=i.preloads.scripts;var Ct=xt.hasOwnProperty(bt)?xt[bt]:void 0;if(Ct!==null){xt[bt]=null;var wt=n;if(Ct){Ct.length===2&&(wt=E({},n),ut(wt,Ct));var Tt=St.get(bt);Tt&&(Tt.length=0)}var Et=[];i.scripts.add(Et),Ae(Et,wt)}l&&e.push(`<!-- -->`),yt=null}return yt;case`style`:var Dt=c.tagScope&1,Ot=n.precedence,kt=n.href,At=n.nonce;if(c.insertionMode===4||Dt||n.itemProp!=null||typeof Ot!=`string`||typeof kt!=`string`||kt===``){e.push(U(`style`));var jt=null,Mt=null,Nt;for(Nt in n)if(D.call(n,Nt)){var Pt=n[Nt];if(Pt!=null)switch(Nt){case`children`:jt=Pt;break;case`dangerouslySetInnerHTML`:Mt=Pt;break;default:H(e,Nt,Pt)}}e.push(`>`);var Ft=Array.isArray(jt)?2>jt.length?jt[0]:null:jt;typeof Ft!=`function`&&typeof Ft!=`symbol`&&Ft!=null&&e.push((``+Ft).replace(Ee,De)),Se(e,Mt,jt),e.push(Ie(`style`));var It=null}else{var Lt=i.styles.get(Ot);if((r.styleResources.hasOwnProperty(kt)?r.styleResources[kt]:void 0)!==null){r.styleResources[kt]=null,Lt||(Lt={precedence:F(Ot),rules:[],hrefs:[],sheets:new Map},i.styles.set(Ot,Lt));var Rt=i.nonce.style;if(!Rt||Rt===At){Lt.hrefs.push(F(kt));var zt=Lt.rules,Y=null,Bt=null,Vt;for(Vt in n)if(D.call(n,Vt)){var Ht=n[Vt];if(Ht!=null)switch(Vt){case`children`:Y=Ht;break;case`dangerouslySetInnerHTML`:Bt=Ht}}var Ut=Array.isArray(Y)?2>Y.length?Y[0]:null:Y;typeof Ut!=`function`&&typeof Ut!=`symbol`&&Ut!=null&&zt.push((``+Ut).replace(Ee,De)),Se(zt,Bt,Y)}}Lt&&s&&s.styles.add(Lt),l&&e.push(`<!-- -->`),It=void 0}return It;case`meta`:var Wt=c.tagScope&1,Gt=c.tagScope&4;if(c.insertionMode===4||Wt||n.itemProp!=null)var Kt=Oe(e,n,`meta`);else l&&e.push(`<!-- -->`),Kt=Gt?null:typeof n.charSet==`string`?Oe(i.charsetChunks,n,`meta`):n.name===`viewport`?Oe(i.viewportChunks,n,`meta`):Oe(i.hoistableChunks,n,`meta`);return Kt;case`listing`:case`pre`:e.push(U(t));var qt=null,Jt=null,Yt;for(Yt in n)if(D.call(n,Yt)){var Xt=n[Yt];if(Xt!=null)switch(Yt){case`children`:qt=Xt;break;case`dangerouslySetInnerHTML`:Jt=Xt;break;default:H(e,Yt,Xt)}}if(e.push(`>`),Jt!=null){if(qt!=null)throw Error(a(60));if(typeof Jt!=`object`||!(`__html`in Jt))throw Error(a(61));var X=Jt.__html;X!=null&&(typeof X==`string`&&0<X.length&&X[0]===`
`?e.push(`
`,X):e.push(``+X))}return typeof qt==`string`&&qt[0]===`
`&&e.push(`
`),qt;case`img`:var Zt=c.tagScope&3,Qt=n.src,Z=n.srcSet;if(!(n.loading===`lazy`||!Qt&&!Z||typeof Qt!=`string`&&Qt!=null||typeof Z!=`string`&&Z!=null||n.fetchPriority===`low`||Zt)&&(typeof Qt!=`string`||Qt[4]!==`:`||Qt[0]!==`d`&&Qt[0]!==`D`||Qt[1]!==`a`&&Qt[1]!==`A`||Qt[2]!==`t`&&Qt[2]!==`T`||Qt[3]!==`a`&&Qt[3]!==`A`)&&(typeof Z!=`string`||Z[4]!==`:`||Z[0]!==`d`&&Z[0]!==`D`||Z[1]!==`a`&&Z[1]!==`A`||Z[2]!==`t`&&Z[2]!==`T`||Z[3]!==`a`&&Z[3]!==`A`)){s!==null&&c.tagScope&64&&(s.suspenseyImages=!0);var $t=typeof n.sizes==`string`?n.sizes:void 0,en=Z?Z+`
`+($t||``):Qt,tn=i.preloads.images,nn=tn.get(en);if(nn)(n.fetchPriority===`high`||10>i.highImagePreloads.size)&&(tn.delete(en),i.highImagePreloads.add(nn));else if(!r.imageResources.hasOwnProperty(en)){r.imageResources[en]=ae;var rn=n.crossOrigin,an=typeof rn==`string`?rn===`use-credentials`?rn:``:void 0,on=i.headers,sn;on&&0<on.remainingCapacity&&typeof n.srcSet!=`string`&&(n.fetchPriority===`high`||500>on.highImagePreloads.length)&&(sn=dt(Qt,`image`,{imageSrcSet:n.srcSet,imageSizes:n.sizes,crossOrigin:an,integrity:n.integrity,nonce:n.nonce,type:n.type,fetchPriority:n.fetchPriority,referrerPolicy:n.refererPolicy}),0<=(on.remainingCapacity-=sn.length+2))?(i.resets.image[en]=ae,on.highImagePreloads&&(on.highImagePreloads+=`, `),on.highImagePreloads+=sn):(nn=[],Te(nn,{rel:`preload`,as:`image`,href:Z?void 0:Qt,imageSrcSet:Z,imageSizes:$t,crossOrigin:an,integrity:n.integrity,type:n.type,fetchPriority:n.fetchPriority,referrerPolicy:n.referrerPolicy}),n.fetchPriority===`high`||10>i.highImagePreloads.size?i.highImagePreloads.add(nn):(i.bulkPreloads.add(nn),tn.set(en,nn)))}}return Oe(e,n,`img`);case`base`:case`area`:case`br`:case`col`:case`embed`:case`hr`:case`keygen`:case`param`:case`source`:case`track`:case`wbr`:return Oe(e,n,t);case`annotation-xml`:case`color-profile`:case`font-face`:case`font-face-src`:case`font-face-uri`:case`font-face-format`:case`font-face-name`:case`missing-glyph`:break;case`head`:if(2>c.insertionMode){var cn=o||i.preamble;if(cn.headChunks)throw Error(a(545,"`<head>`"));o!==null&&e.push(`<!--head-->`),cn.headChunks=[];var ln=je(cn.headChunks,n,`head`)}else ln=Me(e,n,`head`);return ln;case`body`:if(2>c.insertionMode){var un=o||i.preamble;if(un.bodyChunks)throw Error(a(545,"`<body>`"));o!==null&&e.push(`<!--body-->`),un.bodyChunks=[];var dn=je(un.bodyChunks,n,`body`)}else dn=Me(e,n,`body`);return dn;case`html`:if(c.insertionMode===0){var fn=o||i.preamble;if(fn.htmlChunks)throw Error(a(545,"`<html>`"));o!==null&&e.push(`<!--html-->`),fn.htmlChunks=[``];var pn=je(fn.htmlChunks,n,`html`)}else pn=Me(e,n,`html`);return pn;default:if(t.indexOf(`-`)!==-1){e.push(U(t));var mn=null,hn=null,gn;for(gn in n)if(D.call(n,gn)){var _n=n[gn];if(_n!=null){var vn=gn;switch(gn){case`children`:mn=_n;break;case`dangerouslySetInnerHTML`:hn=_n;break;case`style`:me(e,_n);break;case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`ref`:break;case`className`:vn=`class`;default:if(j(gn)&&typeof _n!=`function`&&typeof _n!=`symbol`&&!1!==_n){if(!0===_n)_n=``;else if(typeof _n==`object`)continue;e.push(` `,vn,`="`,F(_n),`"`)}}}}return e.push(`>`),Se(e,hn,mn),mn}}return Me(e,n,t)}var Fe=new Map;function Ie(e){var t=Fe.get(e);return t===void 0&&(t=`</`+e+`>`,Fe.set(e,t)),t}function Le(e,t){e=e.preamble,e.htmlChunks===null&&t.htmlChunks&&(e.htmlChunks=t.htmlChunks),e.headChunks===null&&t.headChunks&&(e.headChunks=t.headChunks),e.bodyChunks===null&&t.bodyChunks&&(e.bodyChunks=t.bodyChunks)}function Re(e,t){t=t.bootstrapChunks;for(var n=0;n<t.length-1;n++)e.push(t[n]);return n<t.length?(n=t[n],t.length=0,e.push(n)):!0}function ze(e,t,n){if(e.push(`<!--$?--><template id="`),n===null)throw Error(a(395));return e.push(t.boundaryPrefix),t=n.toString(16),e.push(t),e.push(`"></template>`)}function Be(e,t,n,r){switch(n.insertionMode){case 0:case 1:case 3:case 2:return e.push(`<div hidden id="`),e.push(t.segmentPrefix),t=r.toString(16),e.push(t),e.push(`">`);case 4:return e.push(`<svg aria-hidden="true" style="display:none" id="`),e.push(t.segmentPrefix),t=r.toString(16),e.push(t),e.push(`">`);case 5:return e.push(`<math aria-hidden="true" style="display:none" id="`),e.push(t.segmentPrefix),t=r.toString(16),e.push(t),e.push(`">`);case 6:return e.push(`<table hidden id="`),e.push(t.segmentPrefix),t=r.toString(16),e.push(t),e.push(`">`);case 7:return e.push(`<table hidden><tbody id="`),e.push(t.segmentPrefix),t=r.toString(16),e.push(t),e.push(`">`);case 8:return e.push(`<table hidden><tr id="`),e.push(t.segmentPrefix),t=r.toString(16),e.push(t),e.push(`">`);case 9:return e.push(`<table hidden><colgroup id="`),e.push(t.segmentPrefix),t=r.toString(16),e.push(t),e.push(`">`);default:throw Error(a(397))}}function Ve(e,t){switch(t.insertionMode){case 0:case 1:case 3:case 2:return e.push(`</div>`);case 4:return e.push(`</svg>`);case 5:return e.push(`</math>`);case 6:return e.push(`</table>`);case 7:return e.push(`</tbody></table>`);case 8:return e.push(`</tr></table>`);case 9:return e.push(`</colgroup></table>`);default:throw Error(a(397))}}var He=/[<\u2028\u2029]/g;function Ue(e){return JSON.stringify(e).replace(He,function(e){switch(e){case`<`:return`\\u003c`;case`\u2028`:return`\\u2028`;case`\u2029`:return`\\u2029`;default:throw Error(`escapeJSStringsForInstructionScripts encountered a match it does not know how to replace. this means the match regex and the replacement characters are no longer in sync. This is a bug in React`)}})}var We=/[&><\u2028\u2029]/g;function Ge(e){return JSON.stringify(e).replace(We,function(e){switch(e){case`&`:return`\\u0026`;case`>`:return`\\u003e`;case`<`:return`\\u003c`;case`\u2028`:return`\\u2028`;case`\u2029`:return`\\u2029`;default:throw Error(`escapeJSObjectForInstructionScripts encountered a match it does not know how to replace. this means the match regex and the replacement characters are no longer in sync. This is a bug in React`)}})}var Ke=!1,qe=!0;function Je(e){var t=e.rules,n=e.hrefs,r=0;if(n.length){for(this.push(oe.startInlineStyle),this.push(` media="not all" data-precedence="`),this.push(e.precedence),this.push(`" data-href="`);r<n.length-1;r++)this.push(n[r]),this.push(` `);for(this.push(n[r]),this.push(`">`),r=0;r<t.length;r++)this.push(t[r]);qe=this.push(`</style>`),Ke=!0,t.length=0,n.length=0}}function G(e){return e.state===2?!1:Ke=!0}function Ye(e,t,n){return Ke=!1,qe=!0,oe=n,t.styles.forEach(Je,e),oe=null,t.stylesheets.forEach(G),Ke&&(n.stylesToHoist=!0),qe}function Xe(e){for(var t=0;t<e.length;t++)this.push(e[t]);e.length=0}var K=[];function Ze(e){Te(K,e.props);for(var t=0;t<K.length;t++)this.push(K[t]);K.length=0,e.state=2}function Qe(e){var t=0<e.sheets.size;e.sheets.forEach(Ze,this),e.sheets.clear();var n=e.rules,r=e.hrefs;if(!t||r.length){if(this.push(oe.startInlineStyle),this.push(` data-precedence="`),this.push(e.precedence),e=0,r.length){for(this.push(`" data-href="`);e<r.length-1;e++)this.push(r[e]),this.push(` `);this.push(r[e])}for(this.push(`">`),e=0;e<n.length;e++)this.push(n[e]);this.push(`</style>`),n.length=0,r.length=0}}function $e(e){if(e.state===0){e.state=1;var t=e.props;for(Te(K,{rel:`preload`,as:`style`,href:e.props.href,crossOrigin:t.crossOrigin,fetchPriority:t.fetchPriority,integrity:t.integrity,media:t.media,hrefLang:t.hrefLang,referrerPolicy:t.referrerPolicy}),e=0;e<K.length;e++)this.push(K[e]);K.length=0}}function et(e){e.sheets.forEach($e,this),e.sheets.clear()}function tt(e,t){!(t.instructions&32)&&(t.instructions|=32,e.push(` id="`,F(`_`+t.idPrefix+`R_`),`"`))}function nt(e,t){e.push(`[`);var n=`[`;t.stylesheets.forEach(function(t){if(t.state!==2)if(t.state===3)e.push(n),t=Ge(``+t.props.href),e.push(t),e.push(`]`),n=`,[`;else{e.push(n);var r=t.props[`data-precedence`],i=t.props,o=L(``+t.props.href);for(var s in o=Ge(o),e.push(o),r=``+r,e.push(`,`),r=Ge(r),e.push(r),i)if(D.call(i,s)&&(r=i[s],r!=null))switch(s){case`href`:case`rel`:case`precedence`:case`data-precedence`:break;case`children`:case`dangerouslySetInnerHTML`:throw Error(a(399,`link`));default:q(e,s,r)}e.push(`]`),n=`,[`,t.state=3}}),e.push(`]`)}function q(e,t,n){var r=t.toLowerCase();switch(typeof n){case`function`:case`symbol`:return}switch(t){case`innerHTML`:case`dangerouslySetInnerHTML`:case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`style`:case`ref`:return;case`className`:r=`class`,t=``+n;break;case`hidden`:if(!1===n)return;t=``;break;case`src`:case`href`:n=L(n),t=``+n;break;default:if(2<t.length&&(t[0]===`o`||t[0]===`O`)&&(t[1]===`n`||t[1]===`N`)||!j(t))return;t=``+n}e.push(`,`),r=Ge(r),e.push(r),e.push(`,`),r=Ge(t),e.push(r)}function J(){return{styles:new Set,stylesheets:new Set,suspenseyImages:!1}}function rt(e){var t=Pn||null;if(t){var n=t.resumableState,r=t.renderState;if(typeof e==`string`&&e){if(!n.dnsResources.hasOwnProperty(e)){n.dnsResources[e]=null,n=r.headers;var i,a;(a=n&&0<n.remainingCapacity)&&(a=(i=`<`+(``+e).replace(ft,pt)+`>; rel=dns-prefetch`,0<=(n.remainingCapacity-=i.length+2))),a?(r.resets.dns[e]=null,n.preconnects&&(n.preconnects+=`, `),n.preconnects+=i):(i=[],Te(i,{href:e,rel:`dns-prefetch`}),r.preconnects.add(i))}Or(t)}}else z.D(e)}function it(e,t){var n=Pn||null;if(n){var r=n.resumableState,i=n.renderState;if(typeof e==`string`&&e){var a=t===`use-credentials`?`credentials`:typeof t==`string`?`anonymous`:`default`;if(!r.connectResources[a].hasOwnProperty(e)){r.connectResources[a][e]=null,r=i.headers;var o,s;if(s=r&&0<r.remainingCapacity){if(s=`<`+(``+e).replace(ft,pt)+`>; rel=preconnect`,typeof t==`string`){var c=(``+t).replace(mt,ht);s+=`; crossorigin="`+c+`"`}s=(o=s,0<=(r.remainingCapacity-=o.length+2))}s?(i.resets.connect[a][e]=null,r.preconnects&&(r.preconnects+=`, `),r.preconnects+=o):(a=[],Te(a,{rel:`preconnect`,href:e,crossOrigin:t}),i.preconnects.add(a))}Or(n)}}else z.C(e,t)}function at(e,t,n){var r=Pn||null;if(r){var i=r.resumableState,a=r.renderState;if(t&&e){switch(t){case`image`:if(n)var o=n.imageSrcSet,s=n.imageSizes,c=n.fetchPriority;var l=o?o+`
`+(s||``):e;if(i.imageResources.hasOwnProperty(l))return;i.imageResources[l]=ae,i=a.headers;var u;i&&0<i.remainingCapacity&&typeof o!=`string`&&c===`high`&&(u=dt(e,t,n),0<=(i.remainingCapacity-=u.length+2))?(a.resets.image[l]=ae,i.highImagePreloads&&(i.highImagePreloads+=`, `),i.highImagePreloads+=u):(i=[],Te(i,E({rel:`preload`,href:o?void 0:e,as:t},n)),c===`high`?a.highImagePreloads.add(i):(a.bulkPreloads.add(i),a.preloads.images.set(l,i)));break;case`style`:if(i.styleResources.hasOwnProperty(e))return;o=[],Te(o,E({rel:`preload`,href:e,as:t},n)),i.styleResources[e]=!n||typeof n.crossOrigin!=`string`&&typeof n.integrity!=`string`?ae:[n.crossOrigin,n.integrity],a.preloads.stylesheets.set(e,o),a.bulkPreloads.add(o);break;case`script`:if(i.scriptResources.hasOwnProperty(e))return;o=[],a.preloads.scripts.set(e,o),a.bulkPreloads.add(o),Te(o,E({rel:`preload`,href:e,as:t},n)),i.scriptResources[e]=!n||typeof n.crossOrigin!=`string`&&typeof n.integrity!=`string`?ae:[n.crossOrigin,n.integrity];break;default:if(i.unknownResources.hasOwnProperty(t)){if(o=i.unknownResources[t],o.hasOwnProperty(e))return}else o={},i.unknownResources[t]=o;if(o[e]=ae,(i=a.headers)&&0<i.remainingCapacity&&t===`font`&&(l=dt(e,t,n),0<=(i.remainingCapacity-=l.length+2)))a.resets.font[e]=ae,i.fontPreloads&&(i.fontPreloads+=`, `),i.fontPreloads+=l;else switch(i=[],e=E({rel:`preload`,href:e,as:t},n),Te(i,e),t){case`font`:a.fontPreloads.add(i);break;default:a.bulkPreloads.add(i)}}Or(r)}}else z.L(e,t,n)}function ot(e,t){var n=Pn||null;if(n){var r=n.resumableState,i=n.renderState;if(e){var a=t&&typeof t.as==`string`?t.as:`script`;switch(a){case`script`:if(r.moduleScriptResources.hasOwnProperty(e))return;a=[],r.moduleScriptResources[e]=!t||typeof t.crossOrigin!=`string`&&typeof t.integrity!=`string`?ae:[t.crossOrigin,t.integrity],i.preloads.moduleScripts.set(e,a);break;default:if(r.moduleUnknownResources.hasOwnProperty(a)){var o=r.unknownResources[a];if(o.hasOwnProperty(e))return}else o={},r.moduleUnknownResources[a]=o;a=[],o[e]=ae}Te(a,E({rel:`modulepreload`,href:e},t)),i.bulkPreloads.add(a),Or(n)}}else z.m(e,t)}function st(e,t,n){var r=Pn||null;if(r){var i=r.resumableState,a=r.renderState;if(e){t||=`default`;var o=a.styles.get(t),s=i.styleResources.hasOwnProperty(e)?i.styleResources[e]:void 0;s!==null&&(i.styleResources[e]=null,o||(o={precedence:F(t),rules:[],hrefs:[],sheets:new Map},a.styles.set(t,o)),t={state:0,props:E({rel:`stylesheet`,href:e,"data-precedence":t},n)},s&&(s.length===2&&ut(t.props,s),(a=a.preloads.stylesheets.get(e))&&0<a.length?a.length=0:t.state=1),o.sheets.set(e,t),Or(r))}}else z.S(e,t,n)}function ct(e,t){var n=Pn||null;if(n){var r=n.resumableState,i=n.renderState;if(e){var a=r.scriptResources.hasOwnProperty(e)?r.scriptResources[e]:void 0;a!==null&&(r.scriptResources[e]=null,t=E({src:e,async:!0},t),a&&(a.length===2&&ut(t,a),e=i.preloads.scripts.get(e))&&(e.length=0),e=[],i.scripts.add(e),Ae(e,t),Or(n))}}else z.X(e,t)}function lt(e,t){var n=Pn||null;if(n){var r=n.resumableState,i=n.renderState;if(e){var a=r.moduleScriptResources.hasOwnProperty(e)?r.moduleScriptResources[e]:void 0;a!==null&&(r.moduleScriptResources[e]=null,t=E({src:e,type:`module`,async:!0},t),a&&(a.length===2&&ut(t,a),e=i.preloads.moduleScripts.get(e))&&(e.length=0),e=[],i.scripts.add(e),Ae(e,t),Or(n))}}else z.M(e,t)}function ut(e,t){e.crossOrigin??=t[0],e.integrity??=t[1]}function dt(e,t,n){for(var r in e=(``+e).replace(ft,pt),t=(``+t).replace(mt,ht),t=`<`+e+`>; rel=preload; as="`+t+`"`,n)D.call(n,r)&&(e=n[r],typeof e==`string`&&(t+=`; `+r.toLowerCase()+`="`+(``+e).replace(mt,ht)+`"`));return t}var ft=/[<>\r\n]/g;function pt(e){switch(e){case`<`:return`%3C`;case`>`:return`%3E`;case`
`:return`%0A`;case`\r`:return`%0D`;default:throw Error(`escapeLinkHrefForHeaderContextReplacer encountered a match it does not know how to replace. this means the match regex and the replacement characters are no longer in sync. This is a bug in React`)}}var mt=/["';,\r\n]/g;function ht(e){switch(e){case`"`:return`%22`;case`'`:return`%27`;case`;`:return`%3B`;case`,`:return`%2C`;case`
`:return`%0A`;case`\r`:return`%0D`;default:throw Error(`escapeStringForLinkHeaderQuotedParamValueContextReplacer encountered a match it does not know how to replace. this means the match regex and the replacement characters are no longer in sync. This is a bug in React`)}}function gt(e){this.styles.add(e)}function _t(e){this.stylesheets.add(e)}function vt(e,t){t.styles.forEach(gt,e),t.stylesheets.forEach(_t,e),t.suspenseyImages&&(e.suspenseyImages=!0)}function yt(e,t){var n=e.idPrefix,r=[],i=e.bootstrapScriptContent,a=e.bootstrapScripts,o=e.bootstrapModules;i!==void 0&&(r.push(`<script`),tt(r,e),r.push(`>`,(``+i).replace(se,ce),`<\/script>`)),i=n+`P:`;var s=n+`S:`;n+=`B:`;var c=new Set,l=new Set,u=new Set,d=new Map,f=new Set,p=new Set,m=new Set,h={images:new Map,stylesheets:new Map,scripts:new Map,moduleScripts:new Map};if(a!==void 0)for(var g=0;g<a.length;g++){var _=a[g],v,y=void 0,b=void 0,x={rel:`preload`,as:`script`,fetchPriority:`low`,nonce:void 0};typeof _==`string`?x.href=v=_:(x.href=v=_.src,x.integrity=b=typeof _.integrity==`string`?_.integrity:void 0,x.crossOrigin=y=typeof _==`string`||_.crossOrigin==null?void 0:_.crossOrigin===`use-credentials`?`use-credentials`:``),_=e;var S=v;_.scriptResources[S]=null,_.moduleScriptResources[S]=null,_=[],Te(_,x),f.add(_),r.push(`<script src="`,F(v),`"`),typeof b==`string`&&r.push(` integrity="`,F(b),`"`),typeof y==`string`&&r.push(` crossorigin="`,F(y),`"`),tt(r,e),r.push(` async=""><\/script>`)}if(o!==void 0)for(a=0;a<o.length;a++)x=o[a],y=v=void 0,b={rel:`modulepreload`,fetchPriority:`low`,nonce:void 0},typeof x==`string`?b.href=g=x:(b.href=g=x.src,b.integrity=y=typeof x.integrity==`string`?x.integrity:void 0,b.crossOrigin=v=typeof x==`string`||x.crossOrigin==null?void 0:x.crossOrigin===`use-credentials`?`use-credentials`:``),x=e,_=g,x.scriptResources[_]=null,x.moduleScriptResources[_]=null,x=[],Te(x,b),f.add(x),r.push(`<script type="module" src="`,F(g),`"`),typeof y==`string`&&r.push(` integrity="`,F(y),`"`),typeof v==`string`&&r.push(` crossorigin="`,F(v),`"`),tt(r,e),r.push(` async=""><\/script>`);return{placeholderPrefix:i,segmentPrefix:s,boundaryPrefix:n,startInlineScript:`<script`,startInlineStyle:`<style`,preamble:{htmlChunks:null,headChunks:null,bodyChunks:null},externalRuntimeScript:null,bootstrapChunks:r,importMapChunks:[],onHeaders:void 0,headers:null,resets:{font:{},dns:{},connect:{default:{},anonymous:{},credentials:{}},image:{},style:{}},charsetChunks:[],viewportChunks:[],hoistableChunks:[],preconnects:c,fontPreloads:l,highImagePreloads:u,styles:d,bootstrapScripts:f,scripts:p,bulkPreloads:m,preloads:h,nonce:{script:void 0,style:void 0},stylesToHoist:!1,generateStaticMarkup:t}}function bt(e,t,n,r){return n.generateStaticMarkup?(e.push(F(t)),!1):(t===``?e=r:(r&&e.push(`<!-- -->`),e.push(F(t)),e=!0),e)}function xt(e,t,n,r){t.generateStaticMarkup||n&&r&&e.push(`<!-- -->`)}var St=Function.prototype.bind,Ct=Symbol.for(`react.client.reference`);function wt(e){if(e==null)return null;if(typeof e==`function`)return e.$$typeof===Ct?null:e.displayName||e.name||null;if(typeof e==`string`)return e;switch(e){case c:return`Fragment`;case u:return`Profiler`;case l:return`StrictMode`;case m:return`Suspense`;case h:return`SuspenseList`;case y:return`Activity`}if(typeof e==`object`)switch(e.$$typeof){case s:return`Portal`;case f:return e.displayName||`Context`;case d:return(e._context.displayName||`Context`)+`.Consumer`;case p:var t=e.render;return e=e.displayName,e||=(e=t.displayName||t.name||``,e===``?`ForwardRef`:`ForwardRef(`+e+`)`),e;case g:return t=e.displayName||null,t===null?wt(e.type)||`Memo`:t;case _:t=e._payload,e=e._init;try{return wt(e(t))}catch{}}return null}var Tt={},Et=null;function Dt(e,t){if(e!==t){e.context._currentValue2=e.parentValue,e=e.parent;var n=t.parent;if(e===null){if(n!==null)throw Error(a(401))}else{if(n===null)throw Error(a(401));Dt(e,n)}t.context._currentValue2=t.value}}function Ot(e){e.context._currentValue2=e.parentValue,e=e.parent,e!==null&&Ot(e)}function kt(e){var t=e.parent;t!==null&&kt(t),e.context._currentValue2=e.value}function At(e,t){if(e.context._currentValue2=e.parentValue,e=e.parent,e===null)throw Error(a(402));e.depth===t.depth?Dt(e,t):At(e,t)}function jt(e,t){var n=t.parent;if(n===null)throw Error(a(402));e.depth===n.depth?Dt(e,n):jt(e,n),t.context._currentValue2=t.value}function Mt(e){var t=Et;t!==e&&(t===null?kt(e):e===null?Ot(t):t.depth===e.depth?Dt(t,e):t.depth>e.depth?At(t,e):jt(t,e),Et=e)}var Nt={enqueueSetState:function(e,t){e=e._reactInternals,e.queue!==null&&e.queue.push(t)},enqueueReplaceState:function(e,t){e=e._reactInternals,e.replace=!0,e.queue=[t]},enqueueForceUpdate:function(){}},Pt={id:1,overflow:``};function Ft(e,t,n){var r=e.id;e=e.overflow;var i=32-It(r)-1;r&=~(1<<i),n+=1;var a=32-It(t)+i;if(30<a){var o=i-i%5;return a=(r&(1<<o)-1).toString(32),r>>=o,i-=o,{id:1<<32-It(t)+i|n<<i|r,overflow:a+e}}return{id:1<<a|n<<i|r,overflow:e}}var It=Math.clz32?Math.clz32:zt,Lt=Math.log,Rt=Math.LN2;function zt(e){return e>>>=0,e===0?32:31-(Lt(e)/Rt|0)|0}function Y(){}var Bt=Error(a(460));function Vt(e,t,n){switch(n=e[n],n===void 0?e.push(t):n!==t&&(t.then(Y,Y),t=n),t.status){case`fulfilled`:return t.value;case`rejected`:throw t.reason;default:switch(typeof t.status==`string`?t.then(Y,Y):(e=t,e.status=`pending`,e.then(function(e){if(t.status===`pending`){var n=t;n.status=`fulfilled`,n.value=e}},function(e){if(t.status===`pending`){var n=t;n.status=`rejected`,n.reason=e}})),t.status){case`fulfilled`:return t.value;case`rejected`:throw t.reason}throw Ht=t,Bt}}var Ht=null;function Ut(){if(Ht===null)throw Error(a(459));var e=Ht;return Ht=null,e}function Wt(e,t){return e===t&&(e!==0||1/e==1/t)||e!==e&&t!==t}var Gt=typeof Object.is==`function`?Object.is:Wt,Kt=null,qt=null,Jt=null,Yt=null,Xt=null,X=null,Zt=!1,Qt=!1,Z=0,$t=0,en=-1,tn=0,nn=null,rn=null,an=0;function on(){if(Kt===null)throw Error(a(321));return Kt}function sn(){if(0<an)throw Error(a(312));return{memoizedState:null,queue:null,next:null}}function cn(){return X===null?Xt===null?(Zt=!1,Xt=X=sn()):(Zt=!0,X=Xt):X.next===null?(Zt=!1,X=X.next=sn()):(Zt=!0,X=X.next),X}function ln(){var e=nn;return nn=null,e}function un(){Yt=Jt=qt=Kt=null,Qt=!1,Xt=null,an=0,X=rn=null}function dn(e,t){return typeof t==`function`?t(e):t}function fn(e,t,n){if(Kt=on(),X=cn(),Zt){var r=X.queue;if(t=r.dispatch,rn!==null&&(n=rn.get(r),n!==void 0)){rn.delete(r),r=X.memoizedState;do r=e(r,n.action),n=n.next;while(n!==null);return X.memoizedState=r,[r,t]}return[X.memoizedState,t]}return e=e===dn?typeof t==`function`?t():t:n===void 0?t:n(t),X.memoizedState=e,e=X.queue={last:null,dispatch:null},e=e.dispatch=mn.bind(null,Kt,e),[X.memoizedState,e]}function pn(e,t){if(Kt=on(),X=cn(),t=t===void 0?null:t,X!==null){var n=X.memoizedState;if(n!==null&&t!==null){var r=n[1];a:if(r===null)r=!1;else{for(var i=0;i<r.length&&i<t.length;i++)if(!Gt(t[i],r[i])){r=!1;break a}r=!0}if(r)return n[0]}}return e=e(),X.memoizedState=[e,t],e}function mn(e,t,n){if(25<=an)throw Error(a(301));if(e===Kt)if(Qt=!0,e={action:n,next:null},rn===null&&(rn=new Map),n=rn.get(t),n===void 0)rn.set(t,e);else{for(t=n;t.next!==null;)t=t.next;t.next=e}}function hn(){throw Error(a(440))}function gn(){throw Error(a(394))}function _n(){throw Error(a(479))}function vn(e,t,n){on();var r=$t++,i=Jt;if(typeof e.$$FORM_ACTION==`function`){var a=null,o=Yt;i=i.formState;var s=e.$$IS_SIGNATURE_EQUAL;if(i!==null&&typeof s==`function`){var c=i[1];s.call(e,i[2],i[3])&&(a=n===void 0?`k`+T(JSON.stringify([o,null,r]),0):`p`+n,c===a&&(en=r,t=i[0]))}var l=e.bind(null,t);return e=function(e){l(e)},typeof l.$$FORM_ACTION==`function`&&(e.$$FORM_ACTION=function(e){e=l.$$FORM_ACTION(e),n!==void 0&&(n+=``,e.action=n);var t=e.data;return t&&(a===null&&(a=n===void 0?`k`+T(JSON.stringify([o,null,r]),0):`p`+n),t.append(`$ACTION_KEY`,a)),e}),[t,e,!1]}var u=e.bind(null,t);return[t,function(e){u(e)},!1]}function yn(e){var t=tn;return tn+=1,nn===null&&(nn=[]),Vt(nn,e,t)}function bn(){throw Error(a(393))}var xn={readContext:function(e){return e._currentValue2},use:function(e){if(typeof e==`object`&&e){if(typeof e.then==`function`)return yn(e);if(e.$$typeof===f)return e._currentValue2}throw Error(a(438,String(e)))},useContext:function(e){return on(),e._currentValue2},useMemo:pn,useReducer:fn,useRef:function(e){Kt=on(),X=cn();var t=X.memoizedState;return t===null?(e={current:e},X.memoizedState=e):t},useState:function(e){return fn(dn,e)},useInsertionEffect:Y,useLayoutEffect:Y,useCallback:function(e,t){return pn(function(){return e},t)},useImperativeHandle:Y,useEffect:Y,useDebugValue:Y,useDeferredValue:function(e,t){return on(),t===void 0?e:t},useTransition:function(){return on(),[!1,gn]},useId:function(){var e=qt.treeContext,t=e.overflow;e=e.id,e=(e&~(1<<32-It(e)-1)).toString(32)+t;var n=Sn;if(n===null)throw Error(a(404));return t=Z++,e=`_`+n.idPrefix+`R_`+e,0<t&&(e+=`H`+t.toString(32)),e+`_`},useSyncExternalStore:function(e,t,n){if(n===void 0)throw Error(a(407));return n()},useOptimistic:function(e){return on(),[e,_n]},useActionState:vn,useFormState:vn,useHostTransitionStatus:function(){return on(),R},useMemoCache:function(e){for(var t=Array(e),n=0;n<e;n++)t[n]=x;return t},useCacheRefresh:function(){return bn},useEffectEvent:function(){return hn}},Sn=null,Cn={getCacheForType:function(){throw Error(a(248))},cacheSignal:function(){throw Error(a(248))}},wn,Tn;function En(e){if(wn===void 0)try{throw Error()}catch(e){var t=e.stack.trim().match(/\n( *(at )?)/);wn=t&&t[1]||``,Tn=-1<e.stack.indexOf(`
    at`)?` (<anonymous>)`:-1<e.stack.indexOf(`@`)?`@unknown:0:0`:``}return`
`+wn+e+Tn}var Dn=!1;function On(e,t){if(!e||Dn)return``;Dn=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var r={DetermineComponentFrameRoot:function(){try{if(t){var n=function(){throw Error()};if(Object.defineProperty(n.prototype,"props",{set:function(){throw Error()}}),typeof Reflect==`object`&&Reflect.construct){try{Reflect.construct(n,[])}catch(e){var r=e}Reflect.construct(e,[],n)}else{try{n.call()}catch(e){r=e}e.call(n.prototype)}}else{try{throw Error()}catch(e){r=e}(n=e())&&typeof n.catch==`function`&&n.catch(function(){})}}catch(e){if(e&&r&&typeof e.stack==`string`)return[e.stack,r.stack]}return[null,null]}};r.DetermineComponentFrameRoot.displayName=`DetermineComponentFrameRoot`;var i=Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot,`name`);i&&i.configurable&&Object.defineProperty(r.DetermineComponentFrameRoot,"name",{value:`DetermineComponentFrameRoot`});var a=r.DetermineComponentFrameRoot(),o=a[0],s=a[1];if(o&&s){var c=o.split(`
`),l=s.split(`
`);for(i=r=0;r<c.length&&!c[r].includes(`DetermineComponentFrameRoot`);)r++;for(;i<l.length&&!l[i].includes(`DetermineComponentFrameRoot`);)i++;if(r===c.length||i===l.length)for(r=c.length-1,i=l.length-1;1<=r&&0<=i&&c[r]!==l[i];)i--;for(;1<=r&&0<=i;r--,i--)if(c[r]!==l[i]){if(r!==1||i!==1)do if(r--,i--,0>i||c[r]!==l[i]){var u=`
`+c[r].replace(` at new `,` at `);return e.displayName&&u.includes(`<anonymous>`)&&(u=u.replace(`<anonymous>`,e.displayName)),u}while(1<=r&&0<=i);break}}}finally{Dn=!1,Error.prepareStackTrace=n}return(n=e?e.displayName||e.name:``)?En(n):``}function kn(e){if(typeof e==`string`)return En(e);if(typeof e==`function`)return e.prototype&&e.prototype.isReactComponent?On(e,!0):On(e,!1);if(typeof e==`object`&&e){switch(e.$$typeof){case p:return On(e.render,!1);case g:return On(e.type,!1);case _:var t=e,n=t._payload;t=t._init;try{e=t(n)}catch{return En(`Lazy`)}return kn(e)}if(typeof e.name==`string`){a:{n=e.name,t=e.env;var r=e.debugLocation;if(r!=null&&(e=Error.prepareStackTrace,Error.prepareStackTrace=void 0,r=r.stack,Error.prepareStackTrace=e,r.startsWith(`Error: react-stack-top-frame
`)&&(r=r.slice(29)),e=r.indexOf(`
`),e!==-1&&(r=r.slice(e+1)),e=r.indexOf(`react_stack_bottom_frame`),e!==-1&&(e=r.lastIndexOf(`
`,e)),e=e===-1?``:r=r.slice(0,e),r=e.lastIndexOf(`
`),e=r===-1?e:e.slice(r+1),e.indexOf(n)!==-1)){n=`
`+e;break a}n=En(n+(t?` [`+t+`]`:``))}return n}}switch(e){case h:return En(`SuspenseList`);case m:return En(`Suspense`)}return``}function An(e,t){return(500<t.byteSize||!1)&&t.contentPreamble===null}function jn(e){if(typeof e==`object`&&e&&typeof e.environmentName==`string`){var t=e.environmentName;e=[e].slice(0),typeof e[0]==`string`?e.splice(0,1,`[%s] `+e[0],` `+t+` `):e.splice(0,0,`[%s]`,` `+t+` `),e.unshift(console),t=St.apply(console.error,e),t()}else console.error(e);return null}function Mn(e,t,n,r,i,a,o,s,c,l,u){var d=new Set;this.destination=null,this.flushScheduled=!1,this.resumableState=e,this.renderState=t,this.rootFormatContext=n,this.progressiveChunkSize=r===void 0?12800:r,this.status=10,this.fatalError=null,this.pendingRootTasks=this.allPendingTasks=this.nextSegmentId=0,this.completedPreambleSegments=this.completedRootSegment=null,this.byteSize=0,this.abortableTasks=d,this.pingedTasks=[],this.clientRenderedBoundaries=[],this.completedBoundaries=[],this.partialBoundaries=[],this.trackedPostpones=null,this.onError=i===void 0?jn:i,this.onPostpone=l===void 0?Y:l,this.onAllReady=a===void 0?Y:a,this.onShellReady=o===void 0?Y:o,this.onShellError=s===void 0?Y:s,this.onFatalError=c===void 0?Y:c,this.formState=u===void 0?null:u}function Nn(e,t,n,r,i,a,o,s,c,l,u,d){return t=new Mn(t,n,r,i,a,o,s,c,l,u,d),n=zn(t,0,null,r,!1,!1),n.parentFlushed=!0,e=Ln(t,null,e,-1,null,n,null,null,t.abortableTasks,null,r,null,Pt,null,null),Bn(e),t.pingedTasks.push(e),t}var Pn=null;function Fn(e,t){e.pingedTasks.push(t),e.pingedTasks.length===1&&(e.flushScheduled=e.destination!==null,gr(e))}function In(e,t,n,r,i){return n={status:0,rootSegmentID:-1,parentFlushed:!1,pendingTasks:0,row:t,completedSegments:[],byteSize:0,fallbackAbortableTasks:n,errorDigest:null,contentState:J(),fallbackState:J(),contentPreamble:r,fallbackPreamble:i,trackedContentKeyPath:null,trackedFallbackNode:null},t!==null&&(t.pendingTasks++,r=t.boundaries,r!==null&&(e.allPendingTasks++,n.pendingTasks++,r.push(n)),e=t.inheritedHoistables,e!==null&&vt(n.contentState,e)),n}function Ln(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m){e.allPendingTasks++,i===null?e.pendingRootTasks++:i.pendingTasks++,p!==null&&p.pendingTasks++;var h={replay:null,node:n,childIndex:r,ping:function(){return Fn(e,h)},blockedBoundary:i,blockedSegment:a,blockedPreamble:o,hoistableState:s,abortSet:c,keyPath:l,formatContext:u,context:d,treeContext:f,row:p,componentStack:m,thenableState:t};return c.add(h),h}function Rn(e,t,n,r,i,a,o,s,c,l,u,d,f,p){e.allPendingTasks++,a===null?e.pendingRootTasks++:a.pendingTasks++,f!==null&&f.pendingTasks++,n.pendingTasks++;var m={replay:n,node:r,childIndex:i,ping:function(){return Fn(e,m)},blockedBoundary:a,blockedSegment:null,blockedPreamble:null,hoistableState:o,abortSet:s,keyPath:c,formatContext:l,context:u,treeContext:d,row:f,componentStack:p,thenableState:t};return s.add(m),m}function zn(e,t,n,r,i,a){return{status:0,parentFlushed:!1,id:-1,index:t,chunks:[],children:[],preambleChildren:[],parentFormatContext:r,boundary:n,lastPushedText:i,textEmbedded:a}}function Bn(e){var t=e.node;if(typeof t==`object`&&t)switch(t.$$typeof){case o:e.componentStack={parent:e.componentStack,type:t.type}}}function Vn(e){return e===null?null:{parent:e.parent,type:`Suspense Fallback`}}function Hn(e){var t={};return e&&Object.defineProperty(t,"componentStack",{configurable:!0,enumerable:!0,get:function(){try{var n=``,r=e;do n+=kn(r.type),r=r.parent;while(r);var i=n}catch(e){i=`
Error generating stack: `+e.message+`
`+e.stack}return Object.defineProperty(t,"componentStack",{value:i}),i}}),t}function Un(e,t,n){if(e=e.onError,t=e(t,n),t==null||typeof t==`string`)return t}function Wn(e,t){var n=e.onShellError,r=e.onFatalError;n(t),r(t),e.destination===null?(e.status=13,e.fatalError=t):(e.status=14,e.destination.destroy(t))}function Q(e,t){Gn(e,t.next,t.hoistables)}function Gn(e,t,n){for(;t!==null;){n!==null&&(vt(t.hoistables,n),t.inheritedHoistables=n);var r=t.boundaries;if(r!==null){t.boundaries=null;for(var i=0;i<r.length;i++){var a=r[i];n!==null&&vt(a.contentState,n),hr(e,a,null,null)}}if(t.pendingTasks--,0<t.pendingTasks)break;n=t.hoistables,t=t.next}}function Kn(e,t){var n=t.boundaries;if(n!==null&&t.pendingTasks===n.length){for(var r=!0,i=0;i<n.length;i++){var a=n[i];if(a.pendingTasks!==1||a.parentFlushed||An(e,a)){r=!1;break}}r&&Gn(e,t,t.hoistables)}}function qn(e){var t={pendingTasks:1,boundaries:null,hoistables:J(),inheritedHoistables:null,together:!1,next:null};return e!==null&&0<e.pendingTasks&&(t.pendingTasks++,t.boundaries=[],e.next=t),t}function Jn(e,t,n,r,i){var a=t.keyPath,o=t.treeContext,s=t.row;t.keyPath=n,n=r.length;var c=null;if(t.replay!==null){var l=t.replay.slots;if(typeof l==`object`&&l)for(var u=0;u<n;u++){var d=i!==`backwards`&&i!==`unstable_legacy-backwards`?u:n-1-u,f=r[d];t.row=c=qn(c),t.treeContext=Ft(o,n,d);var p=l[d];typeof p==`number`?(Qn(e,t,p,f,d),delete l[d]):sr(e,t,f,d),--c.pendingTasks===0&&Q(e,c)}else for(l=0;l<n;l++)u=i!==`backwards`&&i!==`unstable_legacy-backwards`?l:n-1-l,d=r[u],t.row=c=qn(c),t.treeContext=Ft(o,n,u),sr(e,t,d,u),--c.pendingTasks===0&&Q(e,c)}else if(i!==`backwards`&&i!==`unstable_legacy-backwards`)for(i=0;i<n;i++)l=r[i],t.row=c=qn(c),t.treeContext=Ft(o,n,i),sr(e,t,l,i),--c.pendingTasks===0&&Q(e,c);else{for(i=t.blockedSegment,l=i.children.length,u=i.chunks.length,d=n-1;0<=d;d--){f=r[d],t.row=c=qn(c),t.treeContext=Ft(o,n,d),p=zn(e,u,null,t.formatContext,d!==0||i.lastPushedText,!0),i.children.splice(l,0,p),t.blockedSegment=p;try{sr(e,t,f,d),xt(p.chunks,e.renderState,p.lastPushedText,p.textEmbedded),p.status=1,--c.pendingTasks===0&&Q(e,c)}catch(t){throw p.status=e.status===12?3:4,t}}t.blockedSegment=i,i.lastPushedText=!1}s!==null&&c!==null&&0<c.pendingTasks&&(s.pendingTasks++,c.next=s),t.treeContext=o,t.row=s,t.keyPath=a}function Yn(e,t,n,r,i,a){var o=t.thenableState;for(t.thenableState=null,Kt={},qt=t,Jt=e,Yt=n,$t=Z=0,en=-1,tn=0,nn=o,e=r(i,a);Qt;)Qt=!1,$t=Z=0,en=-1,tn=0,an+=1,X=null,e=r(i,a);return un(),e}function Xn(e,t,n,r,i,a,o){var s=!1;if(a!==0&&e.formState!==null){var c=t.blockedSegment;if(c!==null){s=!0,c=c.chunks;for(var l=0;l<a;l++)l===o?c.push(`<!--F!-->`):c.push(`<!--F-->`)}}a=t.keyPath,t.keyPath=n,i?(n=t.treeContext,t.treeContext=Ft(n,1,0),sr(e,t,r,-1),t.treeContext=n):s?sr(e,t,r,-1):$n(e,t,r,-1),t.keyPath=a}function Zn(e,t,n,r,i,o){if(typeof r==`function`)if(r.prototype&&r.prototype.isReactComponent){var s=i;if(`ref`in i)for(var x in s={},i)x!==`ref`&&(s[x]=i[x]);var C=r.defaultProps;if(C)for(var T in s===i&&(s=E({},s,i)),C)s[T]===void 0&&(s[T]=C[T]);i=s,s=Tt,C=r.contextType,typeof C==`object`&&C&&(s=C._currentValue2),s=new r(i,s);var D=s.state===void 0?null:s.state;if(s.updater=Nt,s.props=i,s.state=D,C={queue:[],replace:!1},s._reactInternals=C,o=r.contextType,s.context=typeof o==`object`&&o?o._currentValue2:Tt,o=r.getDerivedStateFromProps,typeof o==`function`&&(o=o(i,D),D=o==null?D:E({},D,o),s.state=D),typeof r.getDerivedStateFromProps!=`function`&&typeof s.getSnapshotBeforeUpdate!=`function`&&(typeof s.UNSAFE_componentWillMount==`function`||typeof s.componentWillMount==`function`))if(r=s.state,typeof s.componentWillMount==`function`&&s.componentWillMount(),typeof s.UNSAFE_componentWillMount==`function`&&s.UNSAFE_componentWillMount(),r!==s.state&&Nt.enqueueReplaceState(s,s.state,null),C.queue!==null&&0<C.queue.length)if(r=C.queue,o=C.replace,C.queue=null,C.replace=!1,o&&r.length===1)s.state=r[0];else{for(C=o?r[0]:s.state,D=!0,o=+!!o;o<r.length;o++)T=r[o],T=typeof T==`function`?T.call(s,C,i,void 0):T,T!=null&&(D?(D=!1,C=E({},C,T)):E(C,T));s.state=C}else C.queue=null;if(r=s.render(),e.status===12)throw null;i=t.keyPath,t.keyPath=n,$n(e,t,r,-1),t.keyPath=i}else{if(r=Yn(e,t,n,r,i,void 0),e.status===12)throw null;Xn(e,t,n,r,Z!==0,$t,en)}else if(typeof r==`string`)if(s=t.blockedSegment,s===null)s=i.children,C=t.formatContext,D=t.keyPath,t.formatContext=ue(C,r,i),t.keyPath=n,sr(e,t,s,-1),t.formatContext=C,t.keyPath=D;else{if(D=W(s.chunks,r,i,e.resumableState,e.renderState,t.blockedPreamble,t.hoistableState,t.formatContext,s.lastPushedText),s.lastPushedText=!1,C=t.formatContext,o=t.keyPath,t.keyPath=n,(t.formatContext=ue(C,r,i)).insertionMode===3){n=zn(e,0,null,t.formatContext,!1,!1),s.preambleChildren.push(n),t.blockedSegment=n;try{n.status=6,sr(e,t,D,-1),xt(n.chunks,e.renderState,n.lastPushedText,n.textEmbedded),n.status=1}finally{t.blockedSegment=s}}else sr(e,t,D,-1);t.formatContext=C,t.keyPath=o;a:{switch(t=s.chunks,e=e.resumableState,r){case`title`:case`style`:case`script`:case`area`:case`base`:case`br`:case`col`:case`embed`:case`hr`:case`img`:case`input`:case`keygen`:case`link`:case`meta`:case`param`:case`source`:case`track`:case`wbr`:break a;case`body`:if(1>=C.insertionMode){e.hasBody=!0;break a}break;case`html`:if(C.insertionMode===0){e.hasHtml=!0;break a}break;case`head`:if(1>=C.insertionMode)break a}t.push(Ie(r))}s.lastPushedText=!1}else{switch(r){case b:case l:case u:case c:r=t.keyPath,t.keyPath=n,$n(e,t,i.children,-1),t.keyPath=r;return;case y:r=t.blockedSegment,r===null?i.mode!==`hidden`&&(r=t.keyPath,t.keyPath=n,sr(e,t,i.children,-1),t.keyPath=r):i.mode!==`hidden`&&(e.renderState.generateStaticMarkup||r.chunks.push(`<!--&-->`),r.lastPushedText=!1,s=t.keyPath,t.keyPath=n,sr(e,t,i.children,-1),t.keyPath=s,e.renderState.generateStaticMarkup||r.chunks.push(`<!--/&-->`),r.lastPushedText=!1);return;case h:a:{if(r=i.children,i=i.revealOrder,i===`forwards`||i===`backwards`||i===`unstable_legacy-backwards`){if(w(r)){Jn(e,t,n,r,i);break a}if((s=ee(r))&&(s=s.call(r))){if(C=s.next(),!C.done){do C=s.next();while(!C.done);Jn(e,t,n,r,i)}break a}}i===`together`?(i=t.keyPath,s=t.row,C=t.row=qn(null),C.boundaries=[],C.together=!0,t.keyPath=n,$n(e,t,r,-1),--C.pendingTasks===0&&Q(e,C),t.keyPath=i,t.row=s,s!==null&&0<C.pendingTasks&&(s.pendingTasks++,C.next=s)):(i=t.keyPath,t.keyPath=n,$n(e,t,r,-1),t.keyPath=i)}return;case S:case v:throw Error(a(343));case m:a:if(t.replay!==null){r=t.keyPath,s=t.formatContext,C=t.row,t.keyPath=n,t.formatContext=fe(e.resumableState,s),t.row=null,n=i.children;try{sr(e,t,n,-1)}finally{t.keyPath=r,t.formatContext=s,t.row=C}}else{r=t.keyPath,o=t.formatContext;var O=t.row,k=t.blockedBoundary;T=t.blockedPreamble;var A=t.hoistableState;x=t.blockedSegment;var j=i.fallback;i=i.children;var M=new Set,N=In(e,t.row,M,null,null);e.trackedPostpones!==null&&(N.trackedContentKeyPath=n);var P=zn(e,x.chunks.length,N,t.formatContext,!1,!1);x.children.push(P),x.lastPushedText=!1;var F=zn(e,0,null,t.formatContext,!1,!1);if(F.parentFlushed=!0,e.trackedPostpones!==null){s=t.componentStack,C=[n[0],`Suspense Fallback`,n[2]],D=[C[1],C[2],[],null],e.trackedPostpones.workingMap.set(C,D),N.trackedFallbackNode=D,t.blockedSegment=P,t.blockedPreamble=N.fallbackPreamble,t.keyPath=C,t.formatContext=de(e.resumableState,o),t.componentStack=Vn(s),P.status=6;try{sr(e,t,j,-1),xt(P.chunks,e.renderState,P.lastPushedText,P.textEmbedded),P.status=1}catch(t){throw P.status=e.status===12?3:4,t}finally{t.blockedSegment=x,t.blockedPreamble=T,t.keyPath=r,t.formatContext=o}t=Ln(e,null,i,-1,N,F,N.contentPreamble,N.contentState,t.abortSet,n,fe(e.resumableState,t.formatContext),t.context,t.treeContext,null,s),Bn(t),e.pingedTasks.push(t)}else{t.blockedBoundary=N,t.blockedPreamble=N.contentPreamble,t.hoistableState=N.contentState,t.blockedSegment=F,t.keyPath=n,t.formatContext=fe(e.resumableState,o),t.row=null,F.status=6;try{if(sr(e,t,i,-1),xt(F.chunks,e.renderState,F.lastPushedText,F.textEmbedded),F.status=1,mr(N,F),N.pendingTasks===0&&N.status===0){if(N.status=1,!An(e,N)){O!==null&&--O.pendingTasks===0&&Q(e,O),e.pendingRootTasks===0&&t.blockedPreamble&&yr(e);break a}}else O!==null&&O.together&&Kn(e,O)}catch(n){N.status=4,e.status===12?(F.status=3,s=e.fatalError):(F.status=4,s=n),C=Hn(t.componentStack),D=Un(e,s,C),N.errorDigest=D,ir(e,N)}finally{t.blockedBoundary=k,t.blockedPreamble=T,t.hoistableState=A,t.blockedSegment=x,t.keyPath=r,t.formatContext=o,t.row=O}t=Ln(e,null,j,-1,k,P,N.fallbackPreamble,N.fallbackState,M,[n[0],`Suspense Fallback`,n[2]],de(e.resumableState,t.formatContext),t.context,t.treeContext,t.row,Vn(t.componentStack)),Bn(t),e.pingedTasks.push(t)}}return}if(typeof r==`object`&&r)switch(r.$$typeof){case p:if(`ref`in i)for(j in s={},i)j!==`ref`&&(s[j]=i[j]);else s=i;r=Yn(e,t,n,r.render,s,o),Xn(e,t,n,r,Z!==0,$t,en);return;case g:Zn(e,t,n,r.type,i,o);return;case f:if(C=i.children,s=t.keyPath,i=i.value,D=r._currentValue2,r._currentValue2=i,o=Et,Et=r={parent:o,depth:o===null?0:o.depth+1,context:r,parentValue:D,value:i},t.context=r,t.keyPath=n,$n(e,t,C,-1),e=Et,e===null)throw Error(a(403));e.context._currentValue2=e.parentValue,e=Et=e.parent,t.context=e,t.keyPath=s;return;case d:i=i.children,r=i(r._context._currentValue2),i=t.keyPath,t.keyPath=n,$n(e,t,r,-1),t.keyPath=i;return;case _:if(s=r._init,r=s(r._payload),e.status===12)throw null;Zn(e,t,n,r,i,o);return}throw Error(a(130,r==null?r:typeof r,``))}}function Qn(e,t,n,r,i){var a=t.replay,o=t.blockedBoundary,s=zn(e,0,null,t.formatContext,!1,!1);s.id=n,s.parentFlushed=!0;try{t.replay=null,t.blockedSegment=s,sr(e,t,r,i),s.status=1,o===null?e.completedRootSegment=s:(mr(o,s),o.parentFlushed&&e.partialBoundaries.push(o))}finally{t.replay=a,t.blockedSegment=null}}function $n(e,t,n,r){t.replay!==null&&typeof t.replay.slots==`number`?Qn(e,t,t.replay.slots,n,r):(t.node=n,t.childIndex=r,n=t.componentStack,Bn(t),er(e,t),t.componentStack=n)}function er(e,t){var n=t.node,r=t.childIndex;if(n!==null){if(typeof n==`object`){switch(n.$$typeof){case o:var i=n.type,c=n.key,l=n.props;n=l.ref;var u=n===void 0?null:n,d=wt(i),p=c??(r===-1?0:r);if(c=[t.keyPath,d,p],t.replay!==null)a:{var h=t.replay;for(r=h.nodes,n=0;n<r.length;n++){var g=r[n];if(p===g[1]){if(g.length===4){if(d!==null&&d!==g[0])throw Error(a(490,g[0],d));var v=g[2];d=g[3],p=t.node,t.replay={nodes:v,slots:d,pendingTasks:1};try{if(Zn(e,t,c,i,l,u),t.replay.pendingTasks===1&&0<t.replay.nodes.length)throw Error(a(488));t.replay.pendingTasks--}catch(a){if(typeof a==`object`&&a&&(a===Bt||typeof a.then==`function`))throw t.node===p?t.replay=h:r.splice(n,1),a;t.replay.pendingTasks--,l=Hn(t.componentStack),c=e,e=t.blockedBoundary,i=a,l=Un(c,i,l),lr(c,e,v,d,i,l)}t.replay=h}else{if(i!==m)throw Error(a(490,`Suspense`,wt(i)||`Unknown`));b:{h=void 0,i=g[5],u=g[2],d=g[3],p=g[4]===null?[]:g[4][2],g=g[4]===null?null:g[4][3];var y=t.keyPath,b=t.formatContext,x=t.row,S=t.replay,C=t.blockedBoundary,T=t.hoistableState,E=l.children,D=l.fallback,O=new Set;l=In(e,t.row,O,null,null),l.parentFlushed=!0,l.rootSegmentID=i,t.blockedBoundary=l,t.hoistableState=l.contentState,t.keyPath=c,t.formatContext=fe(e.resumableState,b),t.row=null,t.replay={nodes:u,slots:d,pendingTasks:1};try{if(sr(e,t,E,-1),t.replay.pendingTasks===1&&0<t.replay.nodes.length)throw Error(a(488));if(t.replay.pendingTasks--,l.pendingTasks===0&&l.status===0){l.status=1,e.completedBoundaries.push(l);break b}}catch(n){l.status=4,v=Hn(t.componentStack),h=Un(e,n,v),l.errorDigest=h,t.replay.pendingTasks--,e.clientRenderedBoundaries.push(l)}finally{t.blockedBoundary=C,t.hoistableState=T,t.replay=S,t.keyPath=y,t.formatContext=b,t.row=x}v=Rn(e,null,{nodes:p,slots:g,pendingTasks:0},D,-1,C,l.fallbackState,O,[c[0],`Suspense Fallback`,c[2]],de(e.resumableState,t.formatContext),t.context,t.treeContext,t.row,Vn(t.componentStack)),Bn(v),e.pingedTasks.push(v)}}r.splice(n,1);break a}}}else Zn(e,t,c,i,l,u);return;case s:throw Error(a(257));case _:if(v=n._init,n=v(n._payload),e.status===12)throw null;$n(e,t,n,r);return}if(w(n)){tr(e,t,n,r);return}if((v=ee(n))&&(v=v.call(n))){if(n=v.next(),!n.done){l=[];do l.push(n.value),n=v.next();while(!n.done);tr(e,t,l,r)}return}if(typeof n.then==`function`)return t.thenableState=null,$n(e,t,yn(n),r);if(n.$$typeof===f)return $n(e,t,n._currentValue2,r);throw r=Object.prototype.toString.call(n),Error(a(31,r===`[object Object]`?`object with keys {`+Object.keys(n).join(`, `)+`}`:r))}typeof n==`string`?(r=t.blockedSegment,r!==null&&(r.lastPushedText=bt(r.chunks,n,e.renderState,r.lastPushedText))):(typeof n==`number`||typeof n==`bigint`)&&(r=t.blockedSegment,r!==null&&(r.lastPushedText=bt(r.chunks,``+n,e.renderState,r.lastPushedText)))}}function tr(e,t,n,r){var i=t.keyPath;if(r!==-1&&(t.keyPath=[t.keyPath,`Fragment`,r],t.replay!==null)){for(var o=t.replay,s=o.nodes,c=0;c<s.length;c++){var l=s[c];if(l[1]===r){r=l[2],l=l[3],t.replay={nodes:r,slots:l,pendingTasks:1};try{if(tr(e,t,n,-1),t.replay.pendingTasks===1&&0<t.replay.nodes.length)throw Error(a(488));t.replay.pendingTasks--}catch(i){if(typeof i==`object`&&i&&(i===Bt||typeof i.then==`function`))throw i;t.replay.pendingTasks--,n=Hn(t.componentStack);var u=t.blockedBoundary,d=i;n=Un(e,d,n),lr(e,u,r,l,d,n)}t.replay=o,s.splice(c,1);break}}t.keyPath=i;return}if(o=t.treeContext,s=n.length,t.replay!==null&&(c=t.replay.slots,typeof c==`object`&&c)){for(r=0;r<s;r++)l=n[r],t.treeContext=Ft(o,s,r),u=c[r],typeof u==`number`?(Qn(e,t,u,l,r),delete c[r]):sr(e,t,l,r);t.treeContext=o,t.keyPath=i;return}for(c=0;c<s;c++)r=n[c],t.treeContext=Ft(o,s,c),sr(e,t,r,c);t.treeContext=o,t.keyPath=i}function nr(e,t,n){if(n.status=5,n.rootSegmentID=e.nextSegmentId++,e=n.trackedContentKeyPath,e===null)throw Error(a(486));var r=n.trackedFallbackNode,i=[],o=t.workingMap.get(e);return o===void 0?(n=[e[1],e[2],i,null,r,n.rootSegmentID],t.workingMap.set(e,n),jr(n,e[0],t),n):(o[4]=r,o[5]=n.rootSegmentID,o)}function rr(e,t,n,r){r.status=5;var i=n.keyPath,o=n.blockedBoundary;if(o===null)r.id=e.nextSegmentId++,t.rootSlots=r.id,e.completedRootSegment!==null&&(e.completedRootSegment.status=5);else{if(o!==null&&o.status===0){var s=nr(e,t,o);if(o.trackedContentKeyPath===i&&n.childIndex===-1){r.id===-1&&(r.id=r.parentFlushed?o.rootSegmentID:e.nextSegmentId++),s[3]=r.id;return}}if(r.id===-1&&(r.id=r.parentFlushed&&o!==null?o.rootSegmentID:e.nextSegmentId++),n.childIndex===-1)i===null?t.rootSlots=r.id:(n=t.workingMap.get(i),n===void 0?(n=[i[1],i[2],[],r.id],jr(n,i[0],t)):n[3]=r.id);else{if(i===null){if(e=t.rootSlots,e===null)e=t.rootSlots={};else if(typeof e==`number`)throw Error(a(491))}else if(o=t.workingMap,s=o.get(i),s===void 0)e={},s=[i[1],i[2],[],e],o.set(i,s),jr(s,i[0],t);else if(e=s[3],e===null)e=s[3]={};else if(typeof e==`number`)throw Error(a(491));e[n.childIndex]=r.id}}}function ir(e,t){e=e.trackedPostpones,e!==null&&(t=t.trackedContentKeyPath,t!==null&&(t=e.workingMap.get(t),t!==void 0&&(t.length=4,t[2]=[],t[3]=null)))}function ar(e,t,n){return Rn(e,n,t.replay,t.node,t.childIndex,t.blockedBoundary,t.hoistableState,t.abortSet,t.keyPath,t.formatContext,t.context,t.treeContext,t.row,t.componentStack)}function or(e,t,n){var r=t.blockedSegment,i=zn(e,r.chunks.length,null,t.formatContext,r.lastPushedText,!0);return r.children.push(i),r.lastPushedText=!1,Ln(e,n,t.node,t.childIndex,t.blockedBoundary,i,t.blockedPreamble,t.hoistableState,t.abortSet,t.keyPath,t.formatContext,t.context,t.treeContext,t.row,t.componentStack)}function sr(e,t,n,r){var i=t.formatContext,a=t.context,o=t.keyPath,s=t.treeContext,c=t.componentStack,l=t.blockedSegment;if(l===null){l=t.replay;try{return $n(e,t,n,r)}catch(u){if(un(),n=u===Bt?Ut():u,e.status!==12&&typeof n==`object`&&n){if(typeof n.then==`function`){r=u===Bt?ln():null,e=ar(e,t,r).ping,n.then(e,e),t.formatContext=i,t.context=a,t.keyPath=o,t.treeContext=s,t.componentStack=c,t.replay=l,Mt(a);return}if(n.message===`Maximum call stack size exceeded`){n=u===Bt?ln():null,n=ar(e,t,n),e.pingedTasks.push(n),t.formatContext=i,t.context=a,t.keyPath=o,t.treeContext=s,t.componentStack=c,t.replay=l,Mt(a);return}}}}else{var u=l.children.length,d=l.chunks.length;try{return $n(e,t,n,r)}catch(r){if(un(),l.children.length=u,l.chunks.length=d,n=r===Bt?Ut():r,e.status!==12&&typeof n==`object`&&n){if(typeof n.then==`function`){l=n,n=r===Bt?ln():null,e=or(e,t,n).ping,l.then(e,e),t.formatContext=i,t.context=a,t.keyPath=o,t.treeContext=s,t.componentStack=c,Mt(a);return}if(n.message===`Maximum call stack size exceeded`){l=r===Bt?ln():null,l=or(e,t,l),e.pingedTasks.push(l),t.formatContext=i,t.context=a,t.keyPath=o,t.treeContext=s,t.componentStack=c,Mt(a);return}}}}throw t.formatContext=i,t.context=a,t.keyPath=o,t.treeContext=s,Mt(a),n}function cr(e){var t=e.blockedBoundary,n=e.blockedSegment;n!==null&&(n.status=3,hr(this,t,e.row,n))}function lr(e,t,n,r,i,o){for(var s=0;s<n.length;s++){var c=n[s];if(c.length===4)lr(e,t,c[2],c[3],i,o);else{c=c[5];var l=e,u=o,d=In(l,null,new Set,null,null);d.parentFlushed=!0,d.rootSegmentID=c,d.status=4,d.errorDigest=u,d.parentFlushed&&l.clientRenderedBoundaries.push(d)}}if(n.length=0,r!==null){if(t===null)throw Error(a(487));if(t.status!==4&&(t.status=4,t.errorDigest=o,t.parentFlushed&&e.clientRenderedBoundaries.push(t)),typeof r==`object`)for(var f in r)delete r[f]}}function ur(e,t,n){var r=e.blockedBoundary,i=e.blockedSegment;if(i!==null){if(i.status===6)return;i.status=3}var a=Hn(e.componentStack);if(r===null){if(t.status!==13&&t.status!==14){if(r=e.replay,r===null){t.trackedPostpones!==null&&i!==null?(r=t.trackedPostpones,Un(t,n,a),rr(t,r,e,i),hr(t,null,e.row,i)):(Un(t,n,a),Wn(t,n));return}r.pendingTasks--,r.pendingTasks===0&&0<r.nodes.length&&(i=Un(t,n,a),lr(t,null,r.nodes,r.slots,n,i)),t.pendingRootTasks--,t.pendingRootTasks===0&&fr(t)}}else{var o=t.trackedPostpones;if(r.status!==4){if(o!==null&&i!==null)return Un(t,n,a),rr(t,o,e,i),r.fallbackAbortableTasks.forEach(function(e){return ur(e,t,n)}),r.fallbackAbortableTasks.clear(),hr(t,r,e.row,i);r.status=4,i=Un(t,n,a),r.status=4,r.errorDigest=i,ir(t,r),r.parentFlushed&&t.clientRenderedBoundaries.push(r)}r.pendingTasks--,i=r.row,i!==null&&--i.pendingTasks===0&&Q(t,i),r.fallbackAbortableTasks.forEach(function(e){return ur(e,t,n)}),r.fallbackAbortableTasks.clear()}e=e.row,e!==null&&--e.pendingTasks===0&&Q(t,e),t.allPendingTasks--,t.allPendingTasks===0&&pr(t)}function dr(e,t){try{var n=e.renderState,r=n.onHeaders;if(r){var i=n.headers;if(i){n.headers=null;var a=i.preconnects;if(i.fontPreloads&&(a&&(a+=`, `),a+=i.fontPreloads),i.highImagePreloads&&(a&&(a+=`, `),a+=i.highImagePreloads),!t){var o=n.styles.values(),s=o.next();b:for(;0<i.remainingCapacity&&!s.done;s=o.next())for(var c=s.value.sheets.values(),l=c.next();0<i.remainingCapacity&&!l.done;l=c.next()){var u=l.value,d=u.props,f=d.href,p=u.props,m=dt(p.href,`style`,{crossOrigin:p.crossOrigin,integrity:p.integrity,nonce:p.nonce,type:p.type,fetchPriority:p.fetchPriority,referrerPolicy:p.referrerPolicy,media:p.media});if(0<=(i.remainingCapacity-=m.length+2))n.resets.style[f]=ae,a&&(a+=`, `),a+=m,n.resets.style[f]=typeof d.crossOrigin==`string`||typeof d.integrity==`string`?[d.crossOrigin,d.integrity]:ae;else break b}}r(a?{Link:a}:{})}}}catch(t){Un(e,t,{})}}function fr(e){e.trackedPostpones===null&&dr(e,!0),e.trackedPostpones===null&&yr(e),e.onShellError=Y,e=e.onShellReady,e()}function pr(e){dr(e,e.trackedPostpones===null||e.completedRootSegment===null||e.completedRootSegment.status!==5),yr(e),e=e.onAllReady,e()}function mr(e,t){if(t.chunks.length===0&&t.children.length===1&&t.children[0].boundary===null&&t.children[0].id===-1){var n=t.children[0];n.id=t.id,n.parentFlushed=!0,n.status!==1&&n.status!==3&&n.status!==4||mr(e,n)}else e.completedSegments.push(t)}function hr(e,t,n,r){if(n!==null&&(--n.pendingTasks===0?Q(e,n):n.together&&Kn(e,n)),e.allPendingTasks--,t===null){if(r!==null&&r.parentFlushed){if(e.completedRootSegment!==null)throw Error(a(389));e.completedRootSegment=r}e.pendingRootTasks--,e.pendingRootTasks===0&&fr(e)}else if(t.pendingTasks--,t.status!==4)if(t.pendingTasks===0){if(t.status===0&&(t.status=1),r!==null&&r.parentFlushed&&(r.status===1||r.status===3)&&mr(t,r),t.parentFlushed&&e.completedBoundaries.push(t),t.status===1)n=t.row,n!==null&&vt(n.hoistables,t.contentState),An(e,t)||(t.fallbackAbortableTasks.forEach(cr,e),t.fallbackAbortableTasks.clear(),n!==null&&--n.pendingTasks===0&&Q(e,n)),e.pendingRootTasks===0&&e.trackedPostpones===null&&t.contentPreamble!==null&&yr(e);else if(t.status===5&&(t=t.row,t!==null)){if(e.trackedPostpones!==null){n=e.trackedPostpones;var i=t.next;if(i!==null&&(r=i.boundaries,r!==null))for(i.boundaries=null,i=0;i<r.length;i++){var o=r[i];nr(e,n,o),hr(e,o,null,null)}}--t.pendingTasks===0&&Q(e,t)}}else r===null||!r.parentFlushed||r.status!==1&&r.status!==3||(mr(t,r),t.completedSegments.length===1&&t.parentFlushed&&e.partialBoundaries.push(t)),t=t.row,t!==null&&t.together&&Kn(e,t);e.allPendingTasks===0&&pr(e)}function gr(e){if(e.status!==14&&e.status!==13){var t=Et,n=re.H;re.H=xn;var r=re.A;re.A=Cn;var i=Pn;Pn=e;var o=Sn;Sn=e.resumableState;try{var s=e.pingedTasks,c;for(c=0;c<s.length;c++){var l=s[c],u=e,d=l.blockedSegment;if(d===null){var f=u;if(l.replay.pendingTasks!==0){Mt(l.context);try{if(typeof l.replay.slots==`number`?Qn(f,l,l.replay.slots,l.node,l.childIndex):er(f,l),l.replay.pendingTasks===1&&0<l.replay.nodes.length)throw Error(a(488));l.replay.pendingTasks--,l.abortSet.delete(l),hr(f,l.blockedBoundary,l.row,null)}catch(e){un();var p=e===Bt?Ut():e;if(typeof p==`object`&&p&&typeof p.then==`function`){var m=l.ping;p.then(m,m),l.thenableState=e===Bt?ln():null}else{l.replay.pendingTasks--,l.abortSet.delete(l);var h=Hn(l.componentStack);u=void 0;var g=f,_=l.blockedBoundary,v=f.status===12?f.fatalError:p,y=l.replay.nodes,b=l.replay.slots;u=Un(g,v,h),lr(g,_,y,b,v,u),f.pendingRootTasks--,f.pendingRootTasks===0&&fr(f),f.allPendingTasks--,f.allPendingTasks===0&&pr(f)}}}}else if(f=void 0,g=d,g.status===0){g.status=6,Mt(l.context);var x=g.children.length,S=g.chunks.length;try{er(u,l),xt(g.chunks,u.renderState,g.lastPushedText,g.textEmbedded),l.abortSet.delete(l),g.status=1,hr(u,l.blockedBoundary,l.row,g)}catch(e){un(),g.children.length=x,g.chunks.length=S;var C=e===Bt?Ut():u.status===12?u.fatalError:e;if(u.status===12&&u.trackedPostpones!==null){var ee=u.trackedPostpones,w=Hn(l.componentStack);l.abortSet.delete(l),Un(u,C,w),rr(u,ee,l,g),hr(u,l.blockedBoundary,l.row,g)}else if(typeof C==`object`&&C&&typeof C.then==`function`){g.status=0,l.thenableState=e===Bt?ln():null;var T=l.ping;C.then(T,T)}else{var E=Hn(l.componentStack);l.abortSet.delete(l),g.status=4;var D=l.blockedBoundary,O=l.row;if(O!==null&&--O.pendingTasks===0&&Q(u,O),u.allPendingTasks--,f=Un(u,C,E),D===null)Wn(u,C);else if(D.pendingTasks--,D.status!==4){D.status=4,D.errorDigest=f,ir(u,D);var k=D.row;k!==null&&--k.pendingTasks===0&&Q(u,k),D.parentFlushed&&u.clientRenderedBoundaries.push(D),u.pendingRootTasks===0&&u.trackedPostpones===null&&D.contentPreamble!==null&&yr(u)}u.allPendingTasks===0&&pr(u)}}}}s.splice(0,c),e.destination!==null&&Dr(e,e.destination)}catch(t){Un(e,t,{}),Wn(e,t)}finally{Sn=o,re.H=n,re.A=r,n===xn&&Mt(t),Pn=i}}}function _r(e,t,n){t.preambleChildren.length&&n.push(t.preambleChildren);for(var r=!1,i=0;i<t.children.length;i++)r=vr(e,t.children[i],n)||r;return r}function vr(e,t,n){var r=t.boundary;if(r===null)return _r(e,t,n);var i=r.contentPreamble,o=r.fallbackPreamble;if(i===null||o===null)return!1;switch(r.status){case 1:if(Le(e.renderState,i),e.byteSize+=r.byteSize,t=r.completedSegments[0],!t)throw Error(a(391));return _r(e,t,n);case 5:if(e.trackedPostpones!==null)return!0;case 4:if(t.status===1)return Le(e.renderState,o),_r(e,t,n);default:return!0}}function yr(e){if(e.completedRootSegment&&e.completedPreambleSegments===null){var t=[],n=e.byteSize,r=vr(e,e.completedRootSegment,t),i=e.renderState.preamble;!1===r||i.headChunks&&i.bodyChunks?e.completedPreambleSegments=t:e.byteSize=n}}function br(e,t,n,r){switch(n.parentFlushed=!0,n.status){case 0:n.id=e.nextSegmentId++;case 5:return r=n.id,n.lastPushedText=!1,n.textEmbedded=!1,e=e.renderState,t.push(`<template id="`),t.push(e.placeholderPrefix),e=r.toString(16),t.push(e),t.push(`"></template>`);case 1:n.status=2;var i=!0,o=n.chunks,s=0;n=n.children;for(var c=0;c<n.length;c++){for(i=n[c];s<i.index;s++)t.push(o[s]);i=Sr(e,t,i,r)}for(;s<o.length-1;s++)t.push(o[s]);return s<o.length&&(i=t.push(o[s])),i;case 3:return!0;default:throw Error(a(390))}}var xr=0;function Sr(e,t,n,r){var i=n.boundary;if(i===null)return br(e,t,n,r);if(i.parentFlushed=!0,i.status===4){var o=i.row;return o!==null&&--o.pendingTasks===0&&Q(e,o),e.renderState.generateStaticMarkup||(i=i.errorDigest,t.push(`<!--$!-->`),t.push(`<template`),i&&(t.push(` data-dgst="`),i=F(i),t.push(i),t.push(`"`)),t.push(`></template>`)),br(e,t,n,r),e=e.renderState.generateStaticMarkup?!0:t.push(`<!--/$-->`),e}if(i.status!==1)return i.status===0&&(i.rootSegmentID=e.nextSegmentId++),0<i.completedSegments.length&&e.partialBoundaries.push(i),ze(t,e.renderState,i.rootSegmentID),r&&vt(r,i.fallbackState),br(e,t,n,r),t.push(`<!--/$-->`);if(!Er&&An(e,i)&&xr+i.byteSize>e.progressiveChunkSize)return i.rootSegmentID=e.nextSegmentId++,e.completedBoundaries.push(i),ze(t,e.renderState,i.rootSegmentID),br(e,t,n,r),t.push(`<!--/$-->`);if(xr+=i.byteSize,r&&vt(r,i.contentState),n=i.row,n!==null&&An(e,i)&&--n.pendingTasks===0&&Q(e,n),e.renderState.generateStaticMarkup||t.push(`<!--$-->`),n=i.completedSegments,n.length!==1)throw Error(a(391));return Sr(e,t,n[0],r),e=e.renderState.generateStaticMarkup?!0:t.push(`<!--/$-->`),e}function Cr(e,t,n,r){return Be(t,e.renderState,n.parentFormatContext,n.id),Sr(e,t,n,r),Ve(t,n.parentFormatContext)}function wr(e,t,n){xr=n.byteSize;for(var r=n.completedSegments,i=0;i<r.length;i++)Tr(e,t,n,r[i]);r.length=0,r=n.row,r!==null&&An(e,n)&&--r.pendingTasks===0&&Q(e,r),Ye(t,n.contentState,e.renderState),r=e.resumableState,e=e.renderState,i=n.rootSegmentID,n=n.contentState;var a=e.stylesToHoist;return e.stylesToHoist=!1,t.push(e.startInlineScript),t.push(`>`),a?(!(r.instructions&4)&&(r.instructions|=4,t.push(`$RX=function(b,c,d,e,f){var a=document.getElementById(b);a&&(b=a.previousSibling,b.data="$!",a=a.dataset,c&&(a.dgst=c),d&&(a.msg=d),e&&(a.stck=e),f&&(a.cstck=f),b._reactRetry&&b._reactRetry())};`)),!(r.instructions&2)&&(r.instructions|=2,t.push(`$RB=[];$RV=function(a){$RT=performance.now();for(var b=0;b<a.length;b+=2){var c=a[b],e=a[b+1];null!==e.parentNode&&e.parentNode.removeChild(e);var f=c.parentNode;if(f){var g=c.previousSibling,h=0;do{if(c&&8===c.nodeType){var d=c.data;if("/$"===d||"/&"===d)if(0===h)break;else h--;else"$"!==d&&"$?"!==d&&"$~"!==d&&"$!"!==d&&"&"!==d||h++}d=c.nextSibling;f.removeChild(c);c=d}while(c);for(;e.firstChild;)f.insertBefore(e.firstChild,c);g.data="$";g._reactRetry&&requestAnimationFrame(g._reactRetry)}}a.length=0};
$RC=function(a,b){if(b=document.getElementById(b))(a=document.getElementById(a))?(a.previousSibling.data="$~",$RB.push(a,b),2===$RB.length&&("number"!==typeof $RT?requestAnimationFrame($RV.bind(null,$RB)):(a=performance.now(),setTimeout($RV.bind(null,$RB),2300>a&&2E3<a?2300-a:$RT+300-a)))):b.parentNode.removeChild(b)};`)),r.instructions&8?t.push(`$RR("`):(r.instructions|=8,t.push(`$RM=new Map;$RR=function(n,w,p){function u(q){this._p=null;q()}for(var r=new Map,t=document,h,b,e=t.querySelectorAll("link[data-precedence],style[data-precedence]"),v=[],k=0;b=e[k++];)"not all"===b.getAttribute("media")?v.push(b):("LINK"===b.tagName&&$RM.set(b.getAttribute("href"),b),r.set(b.dataset.precedence,h=b));e=0;b=[];var l,a;for(k=!0;;){if(k){var f=p[e++];if(!f){k=!1;e=0;continue}var c=!1,m=0;var d=f[m++];if(a=$RM.get(d)){var g=a._p;c=!0}else{a=t.createElement("link");a.href=d;a.rel=
"stylesheet";for(a.dataset.precedence=l=f[m++];g=f[m++];)a.setAttribute(g,f[m++]);g=a._p=new Promise(function(q,x){a.onload=u.bind(a,q);a.onerror=u.bind(a,x)});$RM.set(d,a)}d=a.getAttribute("media");!g||d&&!matchMedia(d).matches||b.push(g);if(c)continue}else{a=v[e++];if(!a)break;l=a.getAttribute("data-precedence");a.removeAttribute("media")}c=r.get(l)||h;c===h&&(h=a);r.set(l,a);c?c.parentNode.insertBefore(a,c.nextSibling):(c=t.head,c.insertBefore(a,c.firstChild))}if(p=document.getElementById(n))p.previousSibling.data=
"$~";Promise.all(b).then($RC.bind(null,n,w),$RX.bind(null,n,"CSS failed to load"))};$RR("`))):(!(r.instructions&2)&&(r.instructions|=2,t.push(`$RB=[];$RV=function(a){$RT=performance.now();for(var b=0;b<a.length;b+=2){var c=a[b],e=a[b+1];null!==e.parentNode&&e.parentNode.removeChild(e);var f=c.parentNode;if(f){var g=c.previousSibling,h=0;do{if(c&&8===c.nodeType){var d=c.data;if("/$"===d||"/&"===d)if(0===h)break;else h--;else"$"!==d&&"$?"!==d&&"$~"!==d&&"$!"!==d&&"&"!==d||h++}d=c.nextSibling;f.removeChild(c);c=d}while(c);for(;e.firstChild;)f.insertBefore(e.firstChild,c);g.data="$";g._reactRetry&&requestAnimationFrame(g._reactRetry)}}a.length=0};
$RC=function(a,b){if(b=document.getElementById(b))(a=document.getElementById(a))?(a.previousSibling.data="$~",$RB.push(a,b),2===$RB.length&&("number"!==typeof $RT?requestAnimationFrame($RV.bind(null,$RB)):(a=performance.now(),setTimeout($RV.bind(null,$RB),2300>a&&2E3<a?2300-a:$RT+300-a)))):b.parentNode.removeChild(b)};`)),t.push(`$RC("`)),r=i.toString(16),t.push(e.boundaryPrefix),t.push(r),t.push(`","`),t.push(e.segmentPrefix),t.push(r),a?(t.push(`",`),nt(t,n)):t.push(`"`),n=t.push(`)<\/script>`),Re(t,e)&&n}function Tr(e,t,n,r){if(r.status===2)return!0;var i=n.contentState,o=r.id;if(o===-1){if((r.id=n.rootSegmentID)===-1)throw Error(a(392));return Cr(e,t,r,i)}return o===n.rootSegmentID?Cr(e,t,r,i):(Cr(e,t,r,i),n=e.resumableState,e=e.renderState,t.push(e.startInlineScript),t.push(`>`),n.instructions&1?t.push(`$RS("`):(n.instructions|=1,t.push(`$RS=function(a,b){a=document.getElementById(a);b=document.getElementById(b);for(a.parentNode.removeChild(a);a.firstChild;)b.parentNode.insertBefore(a.firstChild,b);b.parentNode.removeChild(b)};$RS("`)),t.push(e.segmentPrefix),o=o.toString(16),t.push(o),t.push(`","`),t.push(e.placeholderPrefix),t.push(o),t=t.push(`")<\/script>`),t)}var Er=!1;function Dr(e,t){try{if(!(0<e.pendingRootTasks)){var n,r=e.completedRootSegment;if(r!==null){if(r.status===5)return;var i=e.completedPreambleSegments;if(i===null)return;xr=e.byteSize;var a=e.resumableState,o=e.renderState,s=o.preamble,c=s.htmlChunks,l=s.headChunks,u;if(c){for(u=0;u<c.length;u++)t.push(c[u]);if(l)for(u=0;u<l.length;u++)t.push(l[u]);else{var d=U(`head`);t.push(d),t.push(`>`)}}else if(l)for(u=0;u<l.length;u++)t.push(l[u]);var f=o.charsetChunks;for(u=0;u<f.length;u++)t.push(f[u]);f.length=0,o.preconnects.forEach(Xe,t),o.preconnects.clear();var p=o.viewportChunks;for(u=0;u<p.length;u++)t.push(p[u]);p.length=0,o.fontPreloads.forEach(Xe,t),o.fontPreloads.clear(),o.highImagePreloads.forEach(Xe,t),o.highImagePreloads.clear(),oe=o,o.styles.forEach(Qe,t),oe=null;var m=o.importMapChunks;for(u=0;u<m.length;u++)t.push(m[u]);m.length=0,o.bootstrapScripts.forEach(Xe,t),o.scripts.forEach(Xe,t),o.scripts.clear(),o.bulkPreloads.forEach(Xe,t),o.bulkPreloads.clear(),a.instructions|=32;var h=o.hoistableChunks;for(u=0;u<h.length;u++)t.push(h[u]);for(a=h.length=0;a<i.length;a++){var g=i[a];for(o=0;o<g.length;o++)Sr(e,t,g[o],null)}var _=e.renderState.preamble,v=_.headChunks;if(_.htmlChunks||v){var y=Ie(`head`);t.push(y)}var b=_.bodyChunks;if(b)for(i=0;i<b.length;i++)t.push(b[i]);Sr(e,t,r,null),e.completedRootSegment=null;var x=e.renderState;if(e.allPendingTasks!==0||e.clientRenderedBoundaries.length!==0||e.completedBoundaries.length!==0||e.trackedPostpones!==null&&(e.trackedPostpones.rootNodes.length!==0||e.trackedPostpones.rootSlots!==null)){var S=e.resumableState;if(!(S.instructions&64)){if(S.instructions|=64,t.push(x.startInlineScript),!(S.instructions&32)){S.instructions|=32;var C=`_`+S.idPrefix+`R_`;t.push(` id="`);var ee=F(C);t.push(ee),t.push(`"`)}t.push(`>`),t.push(`requestAnimationFrame(function(){$RT=performance.now()});`),t.push(`<\/script>`)}}Re(t,x)}var w=e.renderState;r=0;var T=w.viewportChunks;for(r=0;r<T.length;r++)t.push(T[r]);T.length=0,w.preconnects.forEach(Xe,t),w.preconnects.clear(),w.fontPreloads.forEach(Xe,t),w.fontPreloads.clear(),w.highImagePreloads.forEach(Xe,t),w.highImagePreloads.clear(),w.styles.forEach(et,t),w.scripts.forEach(Xe,t),w.scripts.clear(),w.bulkPreloads.forEach(Xe,t),w.bulkPreloads.clear();var E=w.hoistableChunks;for(r=0;r<E.length;r++)t.push(E[r]);E.length=0;var D=e.clientRenderedBoundaries;for(n=0;n<D.length;n++){var O=D[n];w=t;var k=e.resumableState,A=e.renderState,j=O.rootSegmentID,M=O.errorDigest;w.push(A.startInlineScript),w.push(`>`),k.instructions&4?w.push(`$RX("`):(k.instructions|=4,w.push(`$RX=function(b,c,d,e,f){var a=document.getElementById(b);a&&(b=a.previousSibling,b.data="$!",a=a.dataset,c&&(a.dgst=c),d&&(a.msg=d),e&&(a.stck=e),f&&(a.cstck=f),b._reactRetry&&b._reactRetry())};;$RX("`)),w.push(A.boundaryPrefix);var N=j.toString(16);if(w.push(N),w.push(`"`),M){w.push(`,`);var P=Ue(M||``);w.push(P)}var te=w.push(`)<\/script>`);if(!te){e.destination=null,n++,D.splice(0,n);return}}D.splice(0,n);var ne=e.completedBoundaries;for(n=0;n<ne.length;n++)if(!wr(e,t,ne[n])){e.destination=null,n++,ne.splice(0,n);return}ne.splice(0,n),Er=!0;var I=e.partialBoundaries;for(n=0;n<I.length;n++){var L=I[n];a:{D=e,O=t,xr=L.byteSize;var re=L.completedSegments;for(te=0;te<re.length;te++)if(!Tr(D,O,L,re[te])){te++,re.splice(0,te);var ie=!1;break a}re.splice(0,te);var R=L.row;R!==null&&R.together&&L.pendingTasks===1&&(R.pendingTasks===1?Gn(D,R,R.hoistables):R.pendingTasks--),ie=Ye(O,L.contentState,D.renderState)}if(!ie){e.destination=null,n++,I.splice(0,n);return}}I.splice(0,n),Er=!1;var z=e.completedBoundaries;for(n=0;n<z.length;n++)if(!wr(e,t,z[n])){e.destination=null,n++,z.splice(0,n);return}z.splice(0,n)}}finally{Er=!1,e.allPendingTasks===0&&e.clientRenderedBoundaries.length===0&&e.completedBoundaries.length===0&&(e.flushScheduled=!1,n=e.resumableState,n.hasBody&&(I=Ie(`body`),t.push(I)),n.hasHtml&&(n=Ie(`html`),t.push(n)),e.status=14,t.push(null),e.destination=null)}}function Or(e){if(!1===e.flushScheduled&&e.pingedTasks.length===0&&e.destination!==null){e.flushScheduled=!0;var t=e.destination;t?Dr(e,t):e.flushScheduled=!1}}function kr(e,t){if(e.status===13)e.status=14,t.destroy(e.fatalError);else if(e.status!==14&&e.destination===null){e.destination=t;try{Dr(e,t)}catch(t){Un(e,t,{}),Wn(e,t)}}}function Ar(e,t){(e.status===11||e.status===10)&&(e.status=12);try{var n=e.abortableTasks;if(0<n.size){var r=t===void 0?Error(a(432)):typeof t==`object`&&t&&typeof t.then==`function`?Error(a(530)):t;e.fatalError=r,n.forEach(function(t){return ur(t,e,r)}),n.clear()}e.destination!==null&&Dr(e,e.destination)}catch(t){Un(e,t,{}),Wn(e,t)}}function jr(e,t,n){if(t===null)n.rootNodes.push(e);else{var r=n.workingMap,i=r.get(t);i===void 0&&(i=[t[1],t[2],[],null],r.set(t,i),jr(i,t[0],n)),i[2].push(e)}}function Mr(){}function Nr(e,t,n,r){var i=!1,o=null,s=``,c=!1;if(t=le(t?t.identifierPrefix:void 0),e=Nn(e,t,yt(t,n),B(0,null,0,null),1/0,Mr,void 0,function(){c=!0},void 0,void 0,void 0),e.flushScheduled=e.destination!==null,gr(e),e.status===10&&(e.status=11),e.trackedPostpones===null&&dr(e,e.pendingRootTasks===0),Ar(e,r),kr(e,{push:function(e){return e!==null&&(s+=e),!0},destroy:function(e){i=!0,o=e}}),i&&o!==r)throw o;if(!c)throw Error(a(426));return s}e.renderToStaticMarkup=function(e,t){return Nr(e,t,!0,`The server used "renderToStaticMarkup" which does not support Suspense. If you intended to have the server wait for the suspended component please switch to "renderToReadableStream" which supports Suspense on the server`)},e.renderToString=function(e,t){return Nr(e,t,!1,`The server used "renderToString" which does not support Suspense. If you intended for this Suspense boundary to render the fallback content on the server consider throwing an Error somewhere within the Suspense boundary. If you intended to have the server wait for the suspended component please switch to "renderToReadableStream" which supports Suspense on the server`)},e.version=`19.2.7`})),v=e((e=>{var r=t(),i=n();function a(e){var t=`https://react.dev/errors/`+e;if(1<arguments.length){t+=`?args[]=`+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+=`&args[]=`+encodeURIComponent(arguments[n])}return`Minified React error #`+e+`; visit `+t+` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`}var o=Symbol.for(`react.transitional.element`),s=Symbol.for(`react.portal`),c=Symbol.for(`react.fragment`),l=Symbol.for(`react.strict_mode`),u=Symbol.for(`react.profiler`),d=Symbol.for(`react.consumer`),f=Symbol.for(`react.context`),p=Symbol.for(`react.forward_ref`),m=Symbol.for(`react.suspense`),h=Symbol.for(`react.suspense_list`),g=Symbol.for(`react.memo`),_=Symbol.for(`react.lazy`),v=Symbol.for(`react.scope`),y=Symbol.for(`react.activity`),b=Symbol.for(`react.legacy_hidden`),x=Symbol.for(`react.memo_cache_sentinel`),S=Symbol.for(`react.view_transition`),C=Symbol.iterator;function ee(e){return typeof e!=`object`||!e?null:(e=C&&e[C]||e[`@@iterator`],typeof e==`function`?e:null)}var w=Array.isArray;function T(e,t){var n=e.length&3,r=e.length-n,i=t;for(t=0;t<r;){var a=e.charCodeAt(t)&255|(e.charCodeAt(++t)&255)<<8|(e.charCodeAt(++t)&255)<<16|(e.charCodeAt(++t)&255)<<24;++t,a=3432918353*(a&65535)+((3432918353*(a>>>16)&65535)<<16)&4294967295,a=a<<15|a>>>17,a=461845907*(a&65535)+((461845907*(a>>>16)&65535)<<16)&4294967295,i^=a,i=i<<13|i>>>19,i=5*(i&65535)+((5*(i>>>16)&65535)<<16)&4294967295,i=(i&65535)+27492+(((i>>>16)+58964&65535)<<16)}switch(a=0,n){case 3:a^=(e.charCodeAt(t+2)&255)<<16;case 2:a^=(e.charCodeAt(t+1)&255)<<8;case 1:a^=e.charCodeAt(t)&255,a=3432918353*(a&65535)+((3432918353*(a>>>16)&65535)<<16)&4294967295,a=a<<15|a>>>17,i^=461845907*(a&65535)+((461845907*(a>>>16)&65535)<<16)&4294967295}return i^=e.length,i^=i>>>16,i=2246822507*(i&65535)+((2246822507*(i>>>16)&65535)<<16)&4294967295,i^=i>>>13,i=3266489909*(i&65535)+((3266489909*(i>>>16)&65535)<<16)&4294967295,(i^i>>>16)>>>0}var E=new MessageChannel,D=[];E.port1.onmessage=function(){var e=D.shift();e&&e()};function O(e){D.push(e),E.port2.postMessage(null)}function k(e){setTimeout(function(){throw e})}var A=Promise,j=typeof queueMicrotask==`function`?queueMicrotask:function(e){A.resolve(null).then(e).catch(k)},M=null,N=0;function P(e,t){if(t.byteLength!==0)if(2048<t.byteLength)0<N&&(e.enqueue(new Uint8Array(M.buffer,0,N)),M=new Uint8Array(2048),N=0),e.enqueue(t);else{var n=M.length-N;n<t.byteLength&&(n===0?e.enqueue(M):(M.set(t.subarray(0,n),N),e.enqueue(M),t=t.subarray(n)),M=new Uint8Array(2048),N=0),M.set(t,N),N+=t.byteLength}}function F(e,t){return P(e,t),!0}function te(e){M&&0<N&&(e.enqueue(new Uint8Array(M.buffer,0,N)),M=null,N=0)}var ne=new TextEncoder;function I(e){return ne.encode(e)}function L(e){return ne.encode(e)}function re(e){return e.byteLength}function ie(e,t){typeof e.error==`function`?e.error(t):e.close()}var R=Object.assign,z=Object.prototype.hasOwnProperty,ae=RegExp(`^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$`),oe={},se={};function ce(e){return z.call(se,e)?!0:z.call(oe,e)?!1:ae.test(e)?se[e]=!0:(oe[e]=!0,!1)}var le=new Set(`animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp`.split(` `)),B=new Map([[`acceptCharset`,`accept-charset`],[`htmlFor`,`for`],[`httpEquiv`,`http-equiv`],[`crossOrigin`,`crossorigin`],[`accentHeight`,`accent-height`],[`alignmentBaseline`,`alignment-baseline`],[`arabicForm`,`arabic-form`],[`baselineShift`,`baseline-shift`],[`capHeight`,`cap-height`],[`clipPath`,`clip-path`],[`clipRule`,`clip-rule`],[`colorInterpolation`,`color-interpolation`],[`colorInterpolationFilters`,`color-interpolation-filters`],[`colorProfile`,`color-profile`],[`colorRendering`,`color-rendering`],[`dominantBaseline`,`dominant-baseline`],[`enableBackground`,`enable-background`],[`fillOpacity`,`fill-opacity`],[`fillRule`,`fill-rule`],[`floodColor`,`flood-color`],[`floodOpacity`,`flood-opacity`],[`fontFamily`,`font-family`],[`fontSize`,`font-size`],[`fontSizeAdjust`,`font-size-adjust`],[`fontStretch`,`font-stretch`],[`fontStyle`,`font-style`],[`fontVariant`,`font-variant`],[`fontWeight`,`font-weight`],[`glyphName`,`glyph-name`],[`glyphOrientationHorizontal`,`glyph-orientation-horizontal`],[`glyphOrientationVertical`,`glyph-orientation-vertical`],[`horizAdvX`,`horiz-adv-x`],[`horizOriginX`,`horiz-origin-x`],[`imageRendering`,`image-rendering`],[`letterSpacing`,`letter-spacing`],[`lightingColor`,`lighting-color`],[`markerEnd`,`marker-end`],[`markerMid`,`marker-mid`],[`markerStart`,`marker-start`],[`overlinePosition`,`overline-position`],[`overlineThickness`,`overline-thickness`],[`paintOrder`,`paint-order`],[`panose-1`,`panose-1`],[`pointerEvents`,`pointer-events`],[`renderingIntent`,`rendering-intent`],[`shapeRendering`,`shape-rendering`],[`stopColor`,`stop-color`],[`stopOpacity`,`stop-opacity`],[`strikethroughPosition`,`strikethrough-position`],[`strikethroughThickness`,`strikethrough-thickness`],[`strokeDasharray`,`stroke-dasharray`],[`strokeDashoffset`,`stroke-dashoffset`],[`strokeLinecap`,`stroke-linecap`],[`strokeLinejoin`,`stroke-linejoin`],[`strokeMiterlimit`,`stroke-miterlimit`],[`strokeOpacity`,`stroke-opacity`],[`strokeWidth`,`stroke-width`],[`textAnchor`,`text-anchor`],[`textDecoration`,`text-decoration`],[`textRendering`,`text-rendering`],[`transformOrigin`,`transform-origin`],[`underlinePosition`,`underline-position`],[`underlineThickness`,`underline-thickness`],[`unicodeBidi`,`unicode-bidi`],[`unicodeRange`,`unicode-range`],[`unitsPerEm`,`units-per-em`],[`vAlphabetic`,`v-alphabetic`],[`vHanging`,`v-hanging`],[`vIdeographic`,`v-ideographic`],[`vMathematical`,`v-mathematical`],[`vectorEffect`,`vector-effect`],[`vertAdvY`,`vert-adv-y`],[`vertOriginX`,`vert-origin-x`],[`vertOriginY`,`vert-origin-y`],[`wordSpacing`,`word-spacing`],[`writingMode`,`writing-mode`],[`xmlnsXlink`,`xmlns:xlink`],[`xHeight`,`x-height`]]),ue=/["'&<>]/;function V(e){if(typeof e==`boolean`||typeof e==`number`||typeof e==`bigint`)return``+e;e=``+e;var t=ue.exec(e);if(t){var n=``,r,i=0;for(r=t.index;r<e.length;r++){switch(e.charCodeAt(r)){case 34:t=`&quot;`;break;case 38:t=`&amp;`;break;case 39:t=`&#x27;`;break;case 60:t=`&lt;`;break;case 62:t=`&gt;`;break;default:continue}i!==r&&(n+=e.slice(i,r)),i=r+1,n+=t}e=i===r?n:n+e.slice(i,r)}return e}var de=/([A-Z])/g,fe=/^ms-/,pe=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function me(e){return pe.test(``+e)?`javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')`:e}var he=r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,ge=i.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,_e={pending:!1,data:null,method:null,action:null},ve=ge.d;ge.d={f:ve.f,r:ve.r,D:ur,C:dr,L:fr,m:pr,X:hr,S:mr,M:gr};var ye=[],be=null;L(`"></template>`);var xe=L(`<script`),H=L(`<\/script>`),Se=L(`<script src="`),Ce=L(`<script type="module" src="`),we=L(` nonce="`),Te=L(` integrity="`),Ee=L(` crossorigin="`),De=L(` async=""><\/script>`),Oe=L(`<style`),ke=/(<\/|<)(s)(cript)/gi;function Ae(e,t,n,r){return``+t+(n===`s`?`\\u0073`:`\\u0053`)+r}var je=L(`<script type="importmap">`),Me=L(`<\/script>`);function Ne(e,t,n,r,i,a){n=typeof t==`string`?t:t&&t.script;var o=n===void 0?xe:L(`<script nonce="`+V(n)+`"`),s=typeof t==`string`?void 0:t&&t.style,c=s===void 0?Oe:L(`<style nonce="`+V(s)+`"`),l=e.idPrefix,u=[],d=e.bootstrapScriptContent,f=e.bootstrapScripts,p=e.bootstrapModules;if(d!==void 0&&(u.push(o),nr(u,e),u.push(J,I((``+d).replace(ke,Ae)),H)),d=[],r!==void 0&&(d.push(je),d.push(I((``+JSON.stringify(r)).replace(ke,Ae))),d.push(Me)),r=i?{preconnects:``,fontPreloads:``,highImagePreloads:``,remainingCapacity:2+(typeof a==`number`?a:2e3)}:null,i={placeholderPrefix:L(l+`P:`),segmentPrefix:L(l+`S:`),boundaryPrefix:L(l+`B:`),startInlineScript:o,startInlineStyle:c,preamble:U(),externalRuntimeScript:null,bootstrapChunks:u,importMapChunks:d,onHeaders:i,headers:r,resets:{font:{},dns:{},connect:{default:{},anonymous:{},credentials:{}},image:{},style:{}},charsetChunks:[],viewportChunks:[],hoistableChunks:[],preconnects:new Set,fontPreloads:new Set,highImagePreloads:new Set,styles:new Map,bootstrapScripts:new Set,scripts:new Set,bulkPreloads:new Set,preloads:{images:new Map,stylesheets:new Map,scripts:new Map,moduleScripts:new Map},nonce:{script:n,style:s},hoistableState:null,stylesToHoist:!1},f!==void 0)for(r=0;r<f.length;r++)l=f[r],s=o=void 0,c={rel:`preload`,as:`script`,fetchPriority:`low`,nonce:t},typeof l==`string`?c.href=a=l:(c.href=a=l.src,c.integrity=s=typeof l.integrity==`string`?l.integrity:void 0,c.crossOrigin=o=typeof l==`string`||l.crossOrigin==null?void 0:l.crossOrigin===`use-credentials`?`use-credentials`:``),l=e,d=a,l.scriptResources[d]=null,l.moduleScriptResources[d]=null,l=[],dt(l,c),i.bootstrapScripts.add(l),u.push(Se,I(V(a)),G),n&&u.push(we,I(V(n)),G),typeof s==`string`&&u.push(Te,I(V(s)),G),typeof o==`string`&&u.push(Ee,I(V(o)),G),nr(u,e),u.push(De);if(p!==void 0)for(t=0;t<p.length;t++)s=p[t],a=r=void 0,o={rel:`modulepreload`,fetchPriority:`low`,nonce:n},typeof s==`string`?o.href=f=s:(o.href=f=s.src,o.integrity=a=typeof s.integrity==`string`?s.integrity:void 0,o.crossOrigin=r=typeof s==`string`||s.crossOrigin==null?void 0:s.crossOrigin===`use-credentials`?`use-credentials`:``),s=e,c=f,s.scriptResources[c]=null,s.moduleScriptResources[c]=null,s=[],dt(s,o),i.bootstrapScripts.add(s),u.push(Ce,I(V(f)),G),n&&u.push(we,I(V(n)),G),typeof a==`string`&&u.push(Te,I(V(a)),G),typeof r==`string`&&u.push(Ee,I(V(r)),G),nr(u,e),u.push(De);return i}function Pe(e,t,n,r,i){return{idPrefix:e===void 0?``:e,nextFormID:0,streamingFormat:0,bootstrapScriptContent:n,bootstrapScripts:r,bootstrapModules:i,instructions:0,hasBody:!1,hasHtml:!1,unknownResources:{},dnsResources:{},connectResources:{default:{},anonymous:{},credentials:{}},imageResources:{},styleResources:{},scriptResources:{},moduleUnknownResources:{},moduleScriptResources:{}}}function U(){return{htmlChunks:null,headChunks:null,bodyChunks:null}}function W(e,t,n,r){return{insertionMode:e,selectedValue:t,tagScope:n,viewTransition:r}}function Fe(e){return W(e===`http://www.w3.org/2000/svg`?4:e===`http://www.w3.org/1998/Math/MathML`?5:0,null,0,null)}function Ie(e,t,n){var r=e.tagScope&-25;switch(t){case`noscript`:return W(2,null,r|1,null);case`select`:return W(2,n.value==null?n.defaultValue:n.value,r,null);case`svg`:return W(4,null,r,null);case`picture`:return W(2,null,r|2,null);case`math`:return W(5,null,r,null);case`foreignObject`:return W(2,null,r,null);case`table`:return W(6,null,r,null);case`thead`:case`tbody`:case`tfoot`:return W(7,null,r,null);case`colgroup`:return W(9,null,r,null);case`tr`:return W(8,null,r,null);case`head`:if(2>e.insertionMode)return W(3,null,r,null);break;case`html`:if(e.insertionMode===0)return W(1,null,r,null)}return 6<=e.insertionMode||2>e.insertionMode?W(2,null,r,null):e.tagScope===r?e:W(e.insertionMode,e.selectedValue,r,null)}function Le(e){return e===null?null:{update:e.update,enter:`none`,exit:`none`,share:e.update,name:e.autoName,autoName:e.autoName,nameIdx:0}}function Re(e,t){return t.tagScope&32&&(e.instructions|=128),W(t.insertionMode,t.selectedValue,t.tagScope|12,Le(t.viewTransition))}function ze(e,t){e=Le(t.viewTransition);var n=t.tagScope|16;return e!==null&&e.share!==`none`&&(n|=64),W(t.insertionMode,t.selectedValue,n,e)}var Be=L(`<!-- -->`);function Ve(e,t,n,r){return t===``?r:(r&&e.push(Be),e.push(I(V(t))),!0)}var He=new Map,Ue=L(` style="`),We=L(`:`),Ge=L(`;`);function Ke(e,t){if(typeof t!=`object`)throw Error(a(62));var n=!0,r;for(r in t)if(z.call(t,r)){var i=t[r];if(i!=null&&typeof i!=`boolean`&&i!==``){if(r.indexOf(`--`)===0){var o=I(V(r));i=I(V((``+i).trim()))}else o=He.get(r),o===void 0&&(o=L(V(r.replace(de,`-$1`).toLowerCase().replace(fe,`-ms-`))),He.set(r,o)),i=typeof i==`number`?i===0||le.has(r)?I(``+i):I(i+`px`):I(V((``+i).trim()));n?(n=!1,e.push(Ue,o,We,i)):e.push(Ge,o,We,i)}}n||e.push(G)}var qe=L(` `),Je=L(`="`),G=L(`"`),Ye=L(`=""`);function Xe(e,t,n){n&&typeof n!=`function`&&typeof n!=`symbol`&&e.push(qe,I(t),Ye)}function K(e,t,n){typeof n!=`function`&&typeof n!=`symbol`&&typeof n!=`boolean`&&e.push(qe,I(t),Je,I(V(n)),G)}var Ze=L(V(`javascript:throw new Error('React form unexpectedly submitted.')`)),Qe=L(`<input type="hidden"`);function $e(e,t){this.push(Qe),et(e),K(this,`name`,t),K(this,`value`,e),this.push(rt)}function et(e){if(typeof e!=`string`)throw Error(a(480))}function tt(e,t){if(typeof t.$$FORM_ACTION==`function`){var n=e.nextFormID++;e=e.idPrefix+n;try{var r=t.$$FORM_ACTION(e);return r&&r.data?.forEach(et),r}catch(e){if(typeof e==`object`&&e&&typeof e.then==`function`)throw e}}return null}function nt(e,t,n,r,i,a,o,s){var c=null;if(typeof r==`function`){var l=tt(t,r);l===null?(e.push(qe,I(`formAction`),Je,Ze,G),o=a=i=r=s=null,ct(t,n)):(s=l.name,r=l.action||``,i=l.encType,a=l.method,o=l.target,c=l.data)}return s!=null&&q(e,`name`,s),r!=null&&q(e,`formAction`,r),i!=null&&q(e,`formEncType`,i),a!=null&&q(e,`formMethod`,a),o!=null&&q(e,`formTarget`,o),c}function q(e,t,n){switch(t){case`className`:K(e,`class`,n);break;case`tabIndex`:K(e,`tabindex`,n);break;case`dir`:case`role`:case`viewBox`:case`width`:case`height`:K(e,t,n);break;case`style`:Ke(e,n);break;case`src`:case`href`:if(n===``)break;case`action`:case`formAction`:if(n==null||typeof n==`function`||typeof n==`symbol`||typeof n==`boolean`)break;n=me(``+n),e.push(qe,I(t),Je,I(V(n)),G);break;case`defaultValue`:case`defaultChecked`:case`innerHTML`:case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`ref`:break;case`autoFocus`:case`multiple`:case`muted`:Xe(e,t.toLowerCase(),n);break;case`xlinkHref`:if(typeof n==`function`||typeof n==`symbol`||typeof n==`boolean`)break;n=me(``+n),e.push(qe,I(`xlink:href`),Je,I(V(n)),G);break;case`contentEditable`:case`spellCheck`:case`draggable`:case`value`:case`autoReverse`:case`externalResourcesRequired`:case`focusable`:case`preserveAlpha`:typeof n!=`function`&&typeof n!=`symbol`&&e.push(qe,I(t),Je,I(V(n)),G);break;case`inert`:case`allowFullScreen`:case`async`:case`autoPlay`:case`controls`:case`default`:case`defer`:case`disabled`:case`disablePictureInPicture`:case`disableRemotePlayback`:case`formNoValidate`:case`hidden`:case`loop`:case`noModule`:case`noValidate`:case`open`:case`playsInline`:case`readOnly`:case`required`:case`reversed`:case`scoped`:case`seamless`:case`itemScope`:n&&typeof n!=`function`&&typeof n!=`symbol`&&e.push(qe,I(t),Ye);break;case`capture`:case`download`:!0===n?e.push(qe,I(t),Ye):!1!==n&&typeof n!=`function`&&typeof n!=`symbol`&&e.push(qe,I(t),Je,I(V(n)),G);break;case`cols`:case`rows`:case`size`:case`span`:typeof n!=`function`&&typeof n!=`symbol`&&!isNaN(n)&&1<=n&&e.push(qe,I(t),Je,I(V(n)),G);break;case`rowSpan`:case`start`:typeof n==`function`||typeof n==`symbol`||isNaN(n)||e.push(qe,I(t),Je,I(V(n)),G);break;case`xlinkActuate`:K(e,`xlink:actuate`,n);break;case`xlinkArcrole`:K(e,`xlink:arcrole`,n);break;case`xlinkRole`:K(e,`xlink:role`,n);break;case`xlinkShow`:K(e,`xlink:show`,n);break;case`xlinkTitle`:K(e,`xlink:title`,n);break;case`xlinkType`:K(e,`xlink:type`,n);break;case`xmlBase`:K(e,`xml:base`,n);break;case`xmlLang`:K(e,`xml:lang`,n);break;case`xmlSpace`:K(e,`xml:space`,n);break;default:if((!(2<t.length)||t[0]!==`o`&&t[0]!==`O`||t[1]!==`n`&&t[1]!==`N`)&&(t=B.get(t)||t,ce(t))){switch(typeof n){case`function`:case`symbol`:return;case`boolean`:var r=t.toLowerCase().slice(0,5);if(r!==`data-`&&r!==`aria-`)return}e.push(qe,I(t),Je,I(V(n)),G)}}}var J=L(`>`),rt=L(`/>`);function it(e,t,n){if(t!=null){if(n!=null)throw Error(a(60));if(typeof t!=`object`||!(`__html`in t))throw Error(a(61));t=t.__html,t!=null&&e.push(I(``+t))}}function at(e){var t=``;return r.Children.forEach(e,function(e){e!=null&&(t+=e)}),t}var ot=L(` selected=""`),st=L(`addEventListener("submit",function(a){if(!a.defaultPrevented){var c=a.target,d=a.submitter,e=c.action,b=d;if(d){var f=d.getAttribute("formAction");null!=f&&(e=f,b=null)}"javascript:throw new Error('React form unexpectedly submitted.')"===e&&(a.preventDefault(),b?(a=document.createElement("input"),a.name=b.name,a.value=b.value,b.parentNode.insertBefore(a,b),b=new FormData(c),a.parentNode.removeChild(a)):b=new FormData(c),a=c.ownerDocument||c,(a.$$reactFormReplay=a.$$reactFormReplay||[]).push(c,d,b))}});`);function ct(e,t){if(!(e.instructions&16)){e.instructions|=16;var n=t.preamble,r=t.bootstrapChunks;(n.htmlChunks||n.headChunks)&&r.length===0?(r.push(t.startInlineScript),nr(r,e),r.push(J,st,H)):r.unshift(t.startInlineScript,J,st,H)}}var lt=L(`<!--F!-->`),ut=L(`<!--F-->`);function dt(e,t){for(var n in e.push(Tt(`link`)),t)if(z.call(t,n)){var r=t[n];if(r!=null)switch(n){case`children`:case`dangerouslySetInnerHTML`:throw Error(a(399,`link`));default:q(e,n,r)}}return e.push(rt),null}var ft=/(<\/|<)(s)(tyle)/gi;function pt(e,t,n,r){return``+t+(n===`s`?`\\73 `:`\\53 `)+r}function mt(e,t,n){for(var r in e.push(Tt(n)),t)if(z.call(t,r)){var i=t[r];if(i!=null)switch(r){case`children`:case`dangerouslySetInnerHTML`:throw Error(a(399,n));default:q(e,r,i)}}return e.push(rt),null}function ht(e,t){e.push(Tt(`title`));var n=null,r=null,i;for(i in t)if(z.call(t,i)){var a=t[i];if(a!=null)switch(i){case`children`:n=a;break;case`dangerouslySetInnerHTML`:r=a;break;default:q(e,i,a)}}return e.push(J),t=Array.isArray(n)?2>n.length?n[0]:null:n,typeof t!=`function`&&typeof t!=`symbol`&&t!=null&&e.push(I(V(``+t))),it(e,r,n),e.push(kt(`title`)),null}var gt=L(`<!--head-->`),_t=L(`<!--body-->`),vt=L(`<!--html-->`);function yt(e,t){e.push(Tt(`script`));var n=null,r=null,i;for(i in t)if(z.call(t,i)){var a=t[i];if(a!=null)switch(i){case`children`:n=a;break;case`dangerouslySetInnerHTML`:r=a;break;default:q(e,i,a)}}return e.push(J),it(e,r,n),typeof n==`string`&&e.push(I((``+n).replace(ke,Ae))),e.push(kt(`script`)),null}function bt(e,t,n){e.push(Tt(n));var r=n=null,i;for(i in t)if(z.call(t,i)){var a=t[i];if(a!=null)switch(i){case`children`:n=a;break;case`dangerouslySetInnerHTML`:r=a;break;default:q(e,i,a)}}return e.push(J),it(e,r,n),n}function xt(e,t,n){e.push(Tt(n));var r=n=null,i;for(i in t)if(z.call(t,i)){var a=t[i];if(a!=null)switch(i){case`children`:n=a;break;case`dangerouslySetInnerHTML`:r=a;break;default:q(e,i,a)}}return e.push(J),it(e,r,n),typeof n==`string`?(e.push(I(V(n))),null):n}var St=L(`
`),Ct=/^[a-zA-Z][a-zA-Z:_\.\-\d]*$/,wt=new Map;function Tt(e){var t=wt.get(e);if(t===void 0){if(!Ct.test(e))throw Error(a(65,e));t=L(`<`+e),wt.set(e,t)}return t}var Et=L(`<!DOCTYPE html>`);function Dt(e,t,n,r,i,o,s,c,l){switch(t){case`div`:case`span`:case`svg`:case`path`:break;case`a`:e.push(Tt(`a`));var u=null,d=null,f;for(f in n)if(z.call(n,f)){var p=n[f];if(p!=null)switch(f){case`children`:u=p;break;case`dangerouslySetInnerHTML`:d=p;break;case`href`:p===``?K(e,`href`,``):q(e,f,p);break;default:q(e,f,p)}}if(e.push(J),it(e,d,u),typeof u==`string`){e.push(I(V(u)));var m=null}else m=u;return m;case`g`:case`p`:case`li`:break;case`select`:e.push(Tt(`select`));var h=null,g=null,_;for(_ in n)if(z.call(n,_)){var v=n[_];if(v!=null)switch(_){case`children`:h=v;break;case`dangerouslySetInnerHTML`:g=v;break;case`defaultValue`:case`value`:break;default:q(e,_,v)}}return e.push(J),it(e,g,h),h;case`option`:var y=c.selectedValue;e.push(Tt(`option`));var b=null,x=null,S=null,C=null,ee;for(ee in n)if(z.call(n,ee)){var T=n[ee];if(T!=null)switch(ee){case`children`:b=T;break;case`selected`:S=T;break;case`dangerouslySetInnerHTML`:C=T;break;case`value`:x=T;default:q(e,ee,T)}}if(y!=null){var E=x===null?at(b):``+x;if(w(y)){for(var D=0;D<y.length;D++)if(``+y[D]===E){e.push(ot);break}}else``+y===E&&e.push(ot)}else S&&e.push(ot);return e.push(J),it(e,C,b),b;case`textarea`:e.push(Tt(`textarea`));var O=null,k=null,A=null,j;for(j in n)if(z.call(n,j)){var M=n[j];if(M!=null)switch(j){case`children`:A=M;break;case`value`:O=M;break;case`defaultValue`:k=M;break;case`dangerouslySetInnerHTML`:throw Error(a(91));default:q(e,j,M)}}if(O===null&&k!==null&&(O=k),e.push(J),A!=null){if(O!=null)throw Error(a(92));if(w(A)){if(1<A.length)throw Error(a(93));O=``+A[0]}O=``+A}return typeof O==`string`&&O[0]===`
`&&e.push(St),O!==null&&e.push(I(V(``+O))),null;case`input`:e.push(Tt(`input`));var N=null,P=null,F=null,te=null,ne=null,L=null,re=null,ie=null,ae=null,oe;for(oe in n)if(z.call(n,oe)){var se=n[oe];if(se!=null)switch(oe){case`children`:case`dangerouslySetInnerHTML`:throw Error(a(399,`input`));case`name`:N=se;break;case`formAction`:P=se;break;case`formEncType`:F=se;break;case`formMethod`:te=se;break;case`formTarget`:ne=se;break;case`defaultChecked`:ae=se;break;case`defaultValue`:re=se;break;case`checked`:ie=se;break;case`value`:L=se;break;default:q(e,oe,se)}}var le=nt(e,r,i,P,F,te,ne,N);return ie===null?ae!==null&&Xe(e,`checked`,ae):Xe(e,`checked`,ie),L===null?re!==null&&q(e,`value`,re):q(e,`value`,L),e.push(rt),le?.forEach($e,e),null;case`button`:e.push(Tt(`button`));var B=null,ue=null,de=null,fe=null,pe=null,he=null,ge=null,_e;for(_e in n)if(z.call(n,_e)){var ve=n[_e];if(ve!=null)switch(_e){case`children`:B=ve;break;case`dangerouslySetInnerHTML`:ue=ve;break;case`name`:de=ve;break;case`formAction`:fe=ve;break;case`formEncType`:pe=ve;break;case`formMethod`:he=ve;break;case`formTarget`:ge=ve;break;default:q(e,_e,ve)}}var be=nt(e,r,i,fe,pe,he,ge,de);if(e.push(J),be?.forEach($e,e),it(e,ue,B),typeof B==`string`){e.push(I(V(B)));var xe=null}else xe=B;return xe;case`form`:e.push(Tt(`form`));var H=null,Se=null,Ce=null,we=null,Te=null,Ee=null,De;for(De in n)if(z.call(n,De)){var Oe=n[De];if(Oe!=null)switch(De){case`children`:H=Oe;break;case`dangerouslySetInnerHTML`:Se=Oe;break;case`action`:Ce=Oe;break;case`encType`:we=Oe;break;case`method`:Te=Oe;break;case`target`:Ee=Oe;break;default:q(e,De,Oe)}}var ke=null,Ae=null;if(typeof Ce==`function`){var je=tt(r,Ce);je===null?(e.push(qe,I(`action`),Je,Ze,G),Ee=Te=we=Ce=null,ct(r,i)):(Ce=je.action||``,we=je.encType,Te=je.method,Ee=je.target,ke=je.data,Ae=je.name)}if(Ce!=null&&q(e,`action`,Ce),we!=null&&q(e,`encType`,we),Te!=null&&q(e,`method`,Te),Ee!=null&&q(e,`target`,Ee),e.push(J),Ae!==null&&(e.push(Qe),K(e,`name`,Ae),e.push(rt),ke?.forEach($e,e)),it(e,Se,H),typeof H==`string`){e.push(I(V(H)));var Me=null}else Me=H;return Me;case`menuitem`:for(var Ne in e.push(Tt(`menuitem`)),n)if(z.call(n,Ne)){var Pe=n[Ne];if(Pe!=null)switch(Ne){case`children`:case`dangerouslySetInnerHTML`:throw Error(a(400));default:q(e,Ne,Pe)}}return e.push(J),null;case`object`:e.push(Tt(`object`));var U=null,W=null,Fe;for(Fe in n)if(z.call(n,Fe)){var Ie=n[Fe];if(Ie!=null)switch(Fe){case`children`:U=Ie;break;case`dangerouslySetInnerHTML`:W=Ie;break;case`data`:var Le=me(``+Ie);if(Le===``)break;e.push(qe,I(`data`),Je,I(V(Le)),G);break;default:q(e,Fe,Ie)}}if(e.push(J),it(e,W,U),typeof U==`string`){e.push(I(V(U)));var Re=null}else Re=U;return Re;case`title`:var ze=c.tagScope&1,Ve=c.tagScope&4;if(c.insertionMode===4||ze||n.itemProp!=null)var He=ht(e,n);else Ve?He=null:(ht(i.hoistableChunks,n),He=void 0);return He;case`link`:var Ue=c.tagScope&1,We=c.tagScope&4,Ge=n.rel,Ye=n.href,et=n.precedence;if(c.insertionMode===4||Ue||n.itemProp!=null||typeof Ge!=`string`||typeof Ye!=`string`||Ye===``){dt(e,n);var st=null}else if(n.rel===`stylesheet`)if(typeof et!=`string`||n.disabled!=null||n.onLoad||n.onError)st=dt(e,n);else{var lt=i.styles.get(et),ut=r.styleResources.hasOwnProperty(Ye)?r.styleResources[Ye]:void 0;if(ut!==null){r.styleResources[Ye]=null,lt||(lt={precedence:I(V(et)),rules:[],hrefs:[],sheets:new Map},i.styles.set(et,lt));var Ct={state:0,props:R({},n,{"data-precedence":n.precedence,precedence:null})};if(ut){ut.length===2&&_r(Ct.props,ut);var wt=i.preloads.stylesheets.get(Ye);wt&&0<wt.length?wt.length=0:Ct.state=1}lt.sheets.set(Ye,Ct),s&&s.stylesheets.add(Ct)}else if(lt){var Dt=lt.sheets.get(Ye);Dt&&s&&s.stylesheets.add(Dt)}l&&e.push(Be),st=null}else n.onLoad||n.onError?st=dt(e,n):(l&&e.push(Be),st=We?null:dt(i.hoistableChunks,n));return st;case`script`:var Ot=c.tagScope&1,At=n.async;if(typeof n.src!=`string`||!n.src||!At||typeof At==`function`||typeof At==`symbol`||n.onLoad||n.onError||c.insertionMode===4||Ot||n.itemProp!=null)var jt=yt(e,n);else{var Mt=n.src;if(n.type===`module`)var Nt=r.moduleScriptResources,Pt=i.preloads.moduleScripts;else Nt=r.scriptResources,Pt=i.preloads.scripts;var Ft=Nt.hasOwnProperty(Mt)?Nt[Mt]:void 0;if(Ft!==null){Nt[Mt]=null;var It=n;if(Ft){Ft.length===2&&(It=R({},n),_r(It,Ft));var Lt=Pt.get(Mt);Lt&&(Lt.length=0)}var Rt=[];i.scripts.add(Rt),yt(Rt,It)}l&&e.push(Be),jt=null}return jt;case`style`:var zt=c.tagScope&1,Y=n.precedence,Bt=n.href,Vt=n.nonce;if(c.insertionMode===4||zt||n.itemProp!=null||typeof Y!=`string`||typeof Bt!=`string`||Bt===``){e.push(Tt(`style`));var Ht=null,Ut=null,Wt;for(Wt in n)if(z.call(n,Wt)){var Gt=n[Wt];if(Gt!=null)switch(Wt){case`children`:Ht=Gt;break;case`dangerouslySetInnerHTML`:Ut=Gt;break;default:q(e,Wt,Gt)}}e.push(J);var Kt=Array.isArray(Ht)?2>Ht.length?Ht[0]:null:Ht;typeof Kt!=`function`&&typeof Kt!=`symbol`&&Kt!=null&&e.push(I((``+Kt).replace(ft,pt))),it(e,Ut,Ht),e.push(kt(`style`));var qt=null}else{var Jt=i.styles.get(Y);if((r.styleResources.hasOwnProperty(Bt)?r.styleResources[Bt]:void 0)!==null){r.styleResources[Bt]=null,Jt||(Jt={precedence:I(V(Y)),rules:[],hrefs:[],sheets:new Map},i.styles.set(Y,Jt));var Yt=i.nonce.style;if(!Yt||Yt===Vt){Jt.hrefs.push(I(V(Bt)));var Xt=Jt.rules,X=null,Zt=null,Qt;for(Qt in n)if(z.call(n,Qt)){var Z=n[Qt];if(Z!=null)switch(Qt){case`children`:X=Z;break;case`dangerouslySetInnerHTML`:Zt=Z}}var $t=Array.isArray(X)?2>X.length?X[0]:null:X;typeof $t!=`function`&&typeof $t!=`symbol`&&$t!=null&&Xt.push(I((``+$t).replace(ft,pt))),it(Xt,Zt,X)}}Jt&&s&&s.styles.add(Jt),l&&e.push(Be),qt=void 0}return qt;case`meta`:var en=c.tagScope&1,tn=c.tagScope&4;if(c.insertionMode===4||en||n.itemProp!=null)var nn=mt(e,n,`meta`);else l&&e.push(Be),nn=tn?null:typeof n.charSet==`string`?mt(i.charsetChunks,n,`meta`):n.name===`viewport`?mt(i.viewportChunks,n,`meta`):mt(i.hoistableChunks,n,`meta`);return nn;case`listing`:case`pre`:e.push(Tt(t));var rn=null,an=null,on;for(on in n)if(z.call(n,on)){var sn=n[on];if(sn!=null)switch(on){case`children`:rn=sn;break;case`dangerouslySetInnerHTML`:an=sn;break;default:q(e,on,sn)}}if(e.push(J),an!=null){if(rn!=null)throw Error(a(60));if(typeof an!=`object`||!(`__html`in an))throw Error(a(61));var cn=an.__html;cn!=null&&(typeof cn==`string`&&0<cn.length&&cn[0]===`
`?e.push(St,I(cn)):e.push(I(``+cn)))}return typeof rn==`string`&&rn[0]===`
`&&e.push(St),rn;case`img`:var ln=c.tagScope&3,un=n.src,dn=n.srcSet;if(!(n.loading===`lazy`||!un&&!dn||typeof un!=`string`&&un!=null||typeof dn!=`string`&&dn!=null||n.fetchPriority===`low`||ln)&&(typeof un!=`string`||un[4]!==`:`||un[0]!==`d`&&un[0]!==`D`||un[1]!==`a`&&un[1]!==`A`||un[2]!==`t`&&un[2]!==`T`||un[3]!==`a`&&un[3]!==`A`)&&(typeof dn!=`string`||dn[4]!==`:`||dn[0]!==`d`&&dn[0]!==`D`||dn[1]!==`a`&&dn[1]!==`A`||dn[2]!==`t`&&dn[2]!==`T`||dn[3]!==`a`&&dn[3]!==`A`)){s!==null&&c.tagScope&64&&(s.suspenseyImages=!0);var fn=typeof n.sizes==`string`?n.sizes:void 0,pn=dn?dn+`
`+(fn||``):un,mn=i.preloads.images,hn=mn.get(pn);if(hn)(n.fetchPriority===`high`||10>i.highImagePreloads.size)&&(mn.delete(pn),i.highImagePreloads.add(hn));else if(!r.imageResources.hasOwnProperty(pn)){r.imageResources[pn]=ye;var gn=n.crossOrigin,_n=typeof gn==`string`?gn===`use-credentials`?gn:``:void 0,vn=i.headers,yn;vn&&0<vn.remainingCapacity&&typeof n.srcSet!=`string`&&(n.fetchPriority===`high`||500>vn.highImagePreloads.length)&&(yn=vr(un,`image`,{imageSrcSet:n.srcSet,imageSizes:n.sizes,crossOrigin:_n,integrity:n.integrity,nonce:n.nonce,type:n.type,fetchPriority:n.fetchPriority,referrerPolicy:n.refererPolicy}),0<=(vn.remainingCapacity-=yn.length+2))?(i.resets.image[pn]=ye,vn.highImagePreloads&&(vn.highImagePreloads+=`, `),vn.highImagePreloads+=yn):(hn=[],dt(hn,{rel:`preload`,as:`image`,href:dn?void 0:un,imageSrcSet:dn,imageSizes:fn,crossOrigin:_n,integrity:n.integrity,type:n.type,fetchPriority:n.fetchPriority,referrerPolicy:n.referrerPolicy}),n.fetchPriority===`high`||10>i.highImagePreloads.size?i.highImagePreloads.add(hn):(i.bulkPreloads.add(hn),mn.set(pn,hn)))}}return mt(e,n,`img`);case`base`:case`area`:case`br`:case`col`:case`embed`:case`hr`:case`keygen`:case`param`:case`source`:case`track`:case`wbr`:return mt(e,n,t);case`annotation-xml`:case`color-profile`:case`font-face`:case`font-face-src`:case`font-face-uri`:case`font-face-format`:case`font-face-name`:case`missing-glyph`:break;case`head`:if(2>c.insertionMode){var bn=o||i.preamble;if(bn.headChunks)throw Error(a(545,"`<head>`"));o!==null&&e.push(gt),bn.headChunks=[];var xn=bt(bn.headChunks,n,`head`)}else xn=xt(e,n,`head`);return xn;case`body`:if(2>c.insertionMode){var Sn=o||i.preamble;if(Sn.bodyChunks)throw Error(a(545,"`<body>`"));o!==null&&e.push(_t),Sn.bodyChunks=[];var Cn=bt(Sn.bodyChunks,n,`body`)}else Cn=xt(e,n,`body`);return Cn;case`html`:if(c.insertionMode===0){var wn=o||i.preamble;if(wn.htmlChunks)throw Error(a(545,"`<html>`"));o!==null&&e.push(vt),wn.htmlChunks=[Et];var Tn=bt(wn.htmlChunks,n,`html`)}else Tn=xt(e,n,`html`);return Tn;default:if(t.indexOf(`-`)!==-1){e.push(Tt(t));var En=null,Dn=null,On;for(On in n)if(z.call(n,On)){var kn=n[On];if(kn!=null){var An=On;switch(On){case`children`:En=kn;break;case`dangerouslySetInnerHTML`:Dn=kn;break;case`style`:Ke(e,kn);break;case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`ref`:break;case`className`:An=`class`;default:if(ce(On)&&typeof kn!=`function`&&typeof kn!=`symbol`&&!1!==kn){if(!0===kn)kn=``;else if(typeof kn==`object`)continue;e.push(qe,I(An),Je,I(V(kn)),G)}}}}return e.push(J),it(e,Dn,En),En}}return xt(e,n,t)}var Ot=new Map;function kt(e){var t=Ot.get(e);return t===void 0&&(t=L(`</`+e+`>`),Ot.set(e,t)),t}function At(e,t){e=e.preamble,e.htmlChunks===null&&t.htmlChunks&&(e.htmlChunks=t.htmlChunks),e.headChunks===null&&t.headChunks&&(e.headChunks=t.headChunks),e.bodyChunks===null&&t.bodyChunks&&(e.bodyChunks=t.bodyChunks)}function jt(e,t){t=t.bootstrapChunks;for(var n=0;n<t.length-1;n++)P(e,t[n]);return n<t.length?(n=t[n],t.length=0,F(e,n)):!0}var Mt=L(`requestAnimationFrame(function(){$RT=performance.now()});`),Nt=L(`<template id="`),Pt=L(`"></template>`),Ft=L(`<!--&-->`),It=L(`<!--/&-->`),Lt=L(`<!--$-->`),Rt=L(`<!--$?--><template id="`),zt=L(`"></template>`),Y=L(`<!--$!-->`),Bt=L(`<!--/$-->`),Vt=L(`<template`),Ht=L(`"`),Ut=L(` data-dgst="`);L(` data-msg="`),L(` data-stck="`),L(` data-cstck="`);var Wt=L(`></template>`);function Gt(e,t,n){if(P(e,Rt),n===null)throw Error(a(395));return P(e,t.boundaryPrefix),P(e,I(n.toString(16))),F(e,zt)}var Kt=L(`<div hidden id="`),qt=L(`">`),Jt=L(`</div>`),Yt=L(`<svg aria-hidden="true" style="display:none" id="`),Xt=L(`">`),X=L(`</svg>`),Zt=L(`<math aria-hidden="true" style="display:none" id="`),Qt=L(`">`),Z=L(`</math>`),$t=L(`<table hidden id="`),en=L(`">`),tn=L(`</table>`),nn=L(`<table hidden><tbody id="`),rn=L(`">`),an=L(`</tbody></table>`),on=L(`<table hidden><tr id="`),sn=L(`">`),cn=L(`</tr></table>`),ln=L(`<table hidden><colgroup id="`),un=L(`">`),dn=L(`</colgroup></table>`);function fn(e,t,n,r){switch(n.insertionMode){case 0:case 1:case 3:case 2:return P(e,Kt),P(e,t.segmentPrefix),P(e,I(r.toString(16))),F(e,qt);case 4:return P(e,Yt),P(e,t.segmentPrefix),P(e,I(r.toString(16))),F(e,Xt);case 5:return P(e,Zt),P(e,t.segmentPrefix),P(e,I(r.toString(16))),F(e,Qt);case 6:return P(e,$t),P(e,t.segmentPrefix),P(e,I(r.toString(16))),F(e,en);case 7:return P(e,nn),P(e,t.segmentPrefix),P(e,I(r.toString(16))),F(e,rn);case 8:return P(e,on),P(e,t.segmentPrefix),P(e,I(r.toString(16))),F(e,sn);case 9:return P(e,ln),P(e,t.segmentPrefix),P(e,I(r.toString(16))),F(e,un);default:throw Error(a(397))}}function pn(e,t){switch(t.insertionMode){case 0:case 1:case 3:case 2:return F(e,Jt);case 4:return F(e,X);case 5:return F(e,Z);case 6:return F(e,tn);case 7:return F(e,an);case 8:return F(e,cn);case 9:return F(e,dn);default:throw Error(a(397))}}var mn=L(`$RS=function(a,b){a=document.getElementById(a);b=document.getElementById(b);for(a.parentNode.removeChild(a);a.firstChild;)b.parentNode.insertBefore(a.firstChild,b);b.parentNode.removeChild(b)};$RS("`),hn=L(`$RS("`),gn=L(`","`),_n=L(`")<\/script>`);L(`<template data-rsi="" data-sid="`),L(`" data-pid="`);var vn=L(`$RB=[];$RV=function(a){$RT=performance.now();for(var b=0;b<a.length;b+=2){var c=a[b],e=a[b+1];null!==e.parentNode&&e.parentNode.removeChild(e);var f=c.parentNode;if(f){var g=c.previousSibling,h=0;do{if(c&&8===c.nodeType){var d=c.data;if("/$"===d||"/&"===d)if(0===h)break;else h--;else"$"!==d&&"$?"!==d&&"$~"!==d&&"$!"!==d&&"&"!==d||h++}d=c.nextSibling;f.removeChild(c);c=d}while(c);for(;e.firstChild;)f.insertBefore(e.firstChild,c);g.data="$";g._reactRetry&&requestAnimationFrame(g._reactRetry)}}a.length=0};
$RC=function(a,b){if(b=document.getElementById(b))(a=document.getElementById(a))?(a.previousSibling.data="$~",$RB.push(a,b),2===$RB.length&&("number"!==typeof $RT?requestAnimationFrame($RV.bind(null,$RB)):(a=performance.now(),setTimeout($RV.bind(null,$RB),2300>a&&2E3<a?2300-a:$RT+300-a)))):b.parentNode.removeChild(b)};`);I(`$RV=function(A,g){function k(a,b){var e=a.getAttribute(b);e&&(b=a.style,l.push(a,b.viewTransitionName,b.viewTransitionClass),"auto"!==e&&(b.viewTransitionClass=e),(a=a.getAttribute("vt-name"))||(a="_T_"+K++ +"_"),b.viewTransitionName=a,B=!0)}var B=!1,K=0,l=[];try{var f=document.__reactViewTransition;if(f){f.finished.finally($RV.bind(null,g));return}var m=new Map;for(f=1;f<g.length;f+=2)for(var h=g[f].querySelectorAll("[vt-share]"),d=0;d<h.length;d++){var c=h[d];m.set(c.getAttribute("vt-name"),c)}var u=[];for(h=0;h<g.length;h+=2){var C=g[h],x=C.parentNode;if(x){var v=x.getBoundingClientRect();if(v.left||v.top||v.width||v.height){c=C;for(f=0;c;){if(8===c.nodeType){var r=c.data;if("/$"===r)if(0===f)break;else f--;else"$"!==r&&"$?"!==r&&"$~"!==r&&"$!"!==r||f++}else if(1===c.nodeType){d=c;var D=d.getAttribute("vt-name"),y=m.get(D);k(d,y?"vt-share":"vt-exit");y&&(k(y,"vt-share"),m.set(D,null));var E=d.querySelectorAll("[vt-share]");for(d=0;d<E.length;d++){var F=E[d],G=F.getAttribute("vt-name"),
H=m.get(G);H&&(k(F,"vt-share"),k(H,"vt-share"),m.set(G,null))}}c=c.nextSibling}for(var I=g[h+1],t=I.firstElementChild;t;)null!==m.get(t.getAttribute("vt-name"))&&k(t,"vt-enter"),t=t.nextElementSibling;c=x;do for(var n=c.firstElementChild;n;){var J=n.getAttribute("vt-update");J&&"none"!==J&&!l.includes(n)&&k(n,"vt-update");n=n.nextElementSibling}while((c=c.parentNode)&&1===c.nodeType&&"none"!==c.getAttribute("vt-update"));u.push.apply(u,I.querySelectorAll('img[src]:not([loading="lazy"])'))}}}if(B){var z=
document.__reactViewTransition=document.startViewTransition({update:function(){A(g);for(var a=[document.documentElement.clientHeight,document.fonts.ready],b={},e=0;e<u.length;b={g:b.g},e++)if(b.g=u[e],!b.g.complete){var p=b.g.getBoundingClientRect();0<p.bottom&&0<p.right&&p.top<window.innerHeight&&p.left<window.innerWidth&&(p=new Promise(function(w){return function(q){w.g.addEventListener("load",q);w.g.addEventListener("error",q)}}(b)),a.push(p))}return Promise.race([Promise.all(a),new Promise(function(w){var q=
performance.now();setTimeout(w,2300>q&&2E3<q?2300-q:500)})])},types:[]});z.ready.finally(function(){for(var a=l.length-3;0<=a;a-=3){var b=l[a],e=b.style;e.viewTransitionName=l[a+1];e.viewTransitionClass=l[a+1];""===b.getAttribute("style")&&b.removeAttribute("style")}});z.finished.finally(function(){document.__reactViewTransition===z&&(document.__reactViewTransition=null)});$RB=[];return}}catch(a){}A(g)}.bind(null,$RV);`);var yn=L(`$RC("`),bn=L(`$RM=new Map;$RR=function(n,w,p){function u(q){this._p=null;q()}for(var r=new Map,t=document,h,b,e=t.querySelectorAll("link[data-precedence],style[data-precedence]"),v=[],k=0;b=e[k++];)"not all"===b.getAttribute("media")?v.push(b):("LINK"===b.tagName&&$RM.set(b.getAttribute("href"),b),r.set(b.dataset.precedence,h=b));e=0;b=[];var l,a;for(k=!0;;){if(k){var f=p[e++];if(!f){k=!1;e=0;continue}var c=!1,m=0;var d=f[m++];if(a=$RM.get(d)){var g=a._p;c=!0}else{a=t.createElement("link");a.href=d;a.rel=
"stylesheet";for(a.dataset.precedence=l=f[m++];g=f[m++];)a.setAttribute(g,f[m++]);g=a._p=new Promise(function(q,x){a.onload=u.bind(a,q);a.onerror=u.bind(a,x)});$RM.set(d,a)}d=a.getAttribute("media");!g||d&&!matchMedia(d).matches||b.push(g);if(c)continue}else{a=v[e++];if(!a)break;l=a.getAttribute("data-precedence");a.removeAttribute("media")}c=r.get(l)||h;c===h&&(h=a);r.set(l,a);c?c.parentNode.insertBefore(a,c.nextSibling):(c=t.head,c.insertBefore(a,c.firstChild))}if(p=document.getElementById(n))p.previousSibling.data=
"$~";Promise.all(b).then($RC.bind(null,n,w),$RX.bind(null,n,"CSS failed to load"))};$RR("`),xn=L(`$RR("`),Sn=L(`","`),Cn=L(`",`),wn=L(`"`),Tn=L(`)<\/script>`);L(`<template data-rci="" data-bid="`),L(`<template data-rri="" data-bid="`),L(`" data-sid="`),L(`" data-sty="`);var En=L(`$RX=function(b,c,d,e,f){var a=document.getElementById(b);a&&(b=a.previousSibling,b.data="$!",a=a.dataset,c&&(a.dgst=c),d&&(a.msg=d),e&&(a.stck=e),f&&(a.cstck=f),b._reactRetry&&b._reactRetry())};`),Dn=L(`$RX=function(b,c,d,e,f){var a=document.getElementById(b);a&&(b=a.previousSibling,b.data="$!",a=a.dataset,c&&(a.dgst=c),d&&(a.msg=d),e&&(a.stck=e),f&&(a.cstck=f),b._reactRetry&&b._reactRetry())};;$RX("`),On=L(`$RX("`),kn=L(`"`),An=L(`,`),jn=L(`)<\/script>`);L(`<template data-rxi="" data-bid="`),L(`" data-dgst="`),L(`" data-msg="`),L(`" data-stck="`),L(`" data-cstck="`);var Mn=/[<\u2028\u2029]/g;function Nn(e){return JSON.stringify(e).replace(Mn,function(e){switch(e){case`<`:return`\\u003c`;case`\u2028`:return`\\u2028`;case`\u2029`:return`\\u2029`;default:throw Error(`escapeJSStringsForInstructionScripts encountered a match it does not know how to replace. this means the match regex and the replacement characters are no longer in sync. This is a bug in React`)}})}var Pn=/[&><\u2028\u2029]/g;function Fn(e){return JSON.stringify(e).replace(Pn,function(e){switch(e){case`&`:return`\\u0026`;case`>`:return`\\u003e`;case`<`:return`\\u003c`;case`\u2028`:return`\\u2028`;case`\u2029`:return`\\u2029`;default:throw Error(`escapeJSObjectForInstructionScripts encountered a match it does not know how to replace. this means the match regex and the replacement characters are no longer in sync. This is a bug in React`)}})}var In=L(` media="not all" data-precedence="`),Ln=L(`" data-href="`),Rn=L(`">`),zn=L(`</style>`),Bn=!1,Vn=!0;function Hn(e){var t=e.rules,n=e.hrefs,r=0;if(n.length){for(P(this,be.startInlineStyle),P(this,In),P(this,e.precedence),P(this,Ln);r<n.length-1;r++)P(this,n[r]),P(this,Yn);for(P(this,n[r]),P(this,Rn),r=0;r<t.length;r++)P(this,t[r]);Vn=F(this,zn),Bn=!0,t.length=0,n.length=0}}function Un(e){return e.state===2?!1:Bn=!0}function Wn(e,t,n){return Bn=!1,Vn=!0,be=n,t.styles.forEach(Hn,e),be=null,t.stylesheets.forEach(Un),Bn&&(n.stylesToHoist=!0),Vn}function Q(e){for(var t=0;t<e.length;t++)P(this,e[t]);e.length=0}var Gn=[];function Kn(e){dt(Gn,e.props);for(var t=0;t<Gn.length;t++)P(this,Gn[t]);Gn.length=0,e.state=2}var qn=L(` data-precedence="`),Jn=L(`" data-href="`),Yn=L(` `),Xn=L(`">`),Zn=L(`</style>`);function Qn(e){var t=0<e.sheets.size;e.sheets.forEach(Kn,this),e.sheets.clear();var n=e.rules,r=e.hrefs;if(!t||r.length){if(P(this,be.startInlineStyle),P(this,qn),P(this,e.precedence),e=0,r.length){for(P(this,Jn);e<r.length-1;e++)P(this,r[e]),P(this,Yn);P(this,r[e])}for(P(this,Xn),e=0;e<n.length;e++)P(this,n[e]);P(this,Zn),n.length=0,r.length=0}}function $n(e){if(e.state===0){e.state=1;var t=e.props;for(dt(Gn,{rel:`preload`,as:`style`,href:e.props.href,crossOrigin:t.crossOrigin,fetchPriority:t.fetchPriority,integrity:t.integrity,media:t.media,hrefLang:t.hrefLang,referrerPolicy:t.referrerPolicy}),e=0;e<Gn.length;e++)P(this,Gn[e]);Gn.length=0}}function er(e){e.sheets.forEach($n,this),e.sheets.clear()}L(`<link rel="expect" href="#`),L(`" blocking="render"/>`);var tr=L(` id="`);function nr(e,t){!(t.instructions&32)&&(t.instructions|=32,e.push(tr,I(V(`_`+t.idPrefix+`R_`)),G))}var rr=L(`[`),ir=L(`,[`),ar=L(`,`),or=L(`]`);function sr(e,t){P(e,rr);var n=rr;t.stylesheets.forEach(function(t){if(t.state!==2)if(t.state===3)P(e,n),P(e,I(Fn(``+t.props.href))),P(e,or),n=ir;else{P(e,n);var r=t.props[`data-precedence`],i=t.props;for(var o in P(e,I(Fn(me(``+t.props.href)))),r=``+r,P(e,ar),P(e,I(Fn(r))),i)if(z.call(i,o)&&(r=i[o],r!=null))switch(o){case`href`:case`rel`:case`precedence`:case`data-precedence`:break;case`children`:case`dangerouslySetInnerHTML`:throw Error(a(399,`link`));default:cr(e,o,r)}P(e,or),n=ir,t.state=3}}),P(e,or)}function cr(e,t,n){var r=t.toLowerCase();switch(typeof n){case`function`:case`symbol`:return}switch(t){case`innerHTML`:case`dangerouslySetInnerHTML`:case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`style`:case`ref`:return;case`className`:r=`class`,t=``+n;break;case`hidden`:if(!1===n)return;t=``;break;case`src`:case`href`:n=me(n),t=``+n;break;default:if(2<t.length&&(t[0]===`o`||t[0]===`O`)&&(t[1]===`n`||t[1]===`N`)||!ce(t))return;t=``+n}P(e,ar),P(e,I(Fn(r))),P(e,ar),P(e,I(Fn(t)))}function lr(){return{styles:new Set,stylesheets:new Set,suspenseyImages:!1}}function ur(e){var t=Ui||null;if(t){var n=t.resumableState,r=t.renderState;if(typeof e==`string`&&e){if(!n.dnsResources.hasOwnProperty(e)){n.dnsResources[e]=null,n=r.headers;var i,a;(a=n&&0<n.remainingCapacity)&&(a=(i=`<`+(``+e).replace(yr,br)+`>; rel=dns-prefetch`,0<=(n.remainingCapacity-=i.length+2))),a?(r.resets.dns[e]=null,n.preconnects&&(n.preconnects+=`, `),n.preconnects+=i):(i=[],dt(i,{href:e,rel:`dns-prefetch`}),r.preconnects.add(i))}Ba(t)}}else ve.D(e)}function dr(e,t){var n=Ui||null;if(n){var r=n.resumableState,i=n.renderState;if(typeof e==`string`&&e){var a=t===`use-credentials`?`credentials`:typeof t==`string`?`anonymous`:`default`;if(!r.connectResources[a].hasOwnProperty(e)){r.connectResources[a][e]=null,r=i.headers;var o,s;if(s=r&&0<r.remainingCapacity){if(s=`<`+(``+e).replace(yr,br)+`>; rel=preconnect`,typeof t==`string`){var c=(``+t).replace(xr,Sr);s+=`; crossorigin="`+c+`"`}s=(o=s,0<=(r.remainingCapacity-=o.length+2))}s?(i.resets.connect[a][e]=null,r.preconnects&&(r.preconnects+=`, `),r.preconnects+=o):(a=[],dt(a,{rel:`preconnect`,href:e,crossOrigin:t}),i.preconnects.add(a))}Ba(n)}}else ve.C(e,t)}function fr(e,t,n){var r=Ui||null;if(r){var i=r.resumableState,a=r.renderState;if(t&&e){switch(t){case`image`:if(n)var o=n.imageSrcSet,s=n.imageSizes,c=n.fetchPriority;var l=o?o+`
`+(s||``):e;if(i.imageResources.hasOwnProperty(l))return;i.imageResources[l]=ye,i=a.headers;var u;i&&0<i.remainingCapacity&&typeof o!=`string`&&c===`high`&&(u=vr(e,t,n),0<=(i.remainingCapacity-=u.length+2))?(a.resets.image[l]=ye,i.highImagePreloads&&(i.highImagePreloads+=`, `),i.highImagePreloads+=u):(i=[],dt(i,R({rel:`preload`,href:o?void 0:e,as:t},n)),c===`high`?a.highImagePreloads.add(i):(a.bulkPreloads.add(i),a.preloads.images.set(l,i)));break;case`style`:if(i.styleResources.hasOwnProperty(e))return;o=[],dt(o,R({rel:`preload`,href:e,as:t},n)),i.styleResources[e]=!n||typeof n.crossOrigin!=`string`&&typeof n.integrity!=`string`?ye:[n.crossOrigin,n.integrity],a.preloads.stylesheets.set(e,o),a.bulkPreloads.add(o);break;case`script`:if(i.scriptResources.hasOwnProperty(e))return;o=[],a.preloads.scripts.set(e,o),a.bulkPreloads.add(o),dt(o,R({rel:`preload`,href:e,as:t},n)),i.scriptResources[e]=!n||typeof n.crossOrigin!=`string`&&typeof n.integrity!=`string`?ye:[n.crossOrigin,n.integrity];break;default:if(i.unknownResources.hasOwnProperty(t)){if(o=i.unknownResources[t],o.hasOwnProperty(e))return}else o={},i.unknownResources[t]=o;if(o[e]=ye,(i=a.headers)&&0<i.remainingCapacity&&t===`font`&&(l=vr(e,t,n),0<=(i.remainingCapacity-=l.length+2)))a.resets.font[e]=ye,i.fontPreloads&&(i.fontPreloads+=`, `),i.fontPreloads+=l;else switch(i=[],e=R({rel:`preload`,href:e,as:t},n),dt(i,e),t){case`font`:a.fontPreloads.add(i);break;default:a.bulkPreloads.add(i)}}Ba(r)}}else ve.L(e,t,n)}function pr(e,t){var n=Ui||null;if(n){var r=n.resumableState,i=n.renderState;if(e){var a=t&&typeof t.as==`string`?t.as:`script`;switch(a){case`script`:if(r.moduleScriptResources.hasOwnProperty(e))return;a=[],r.moduleScriptResources[e]=!t||typeof t.crossOrigin!=`string`&&typeof t.integrity!=`string`?ye:[t.crossOrigin,t.integrity],i.preloads.moduleScripts.set(e,a);break;default:if(r.moduleUnknownResources.hasOwnProperty(a)){var o=r.unknownResources[a];if(o.hasOwnProperty(e))return}else o={},r.moduleUnknownResources[a]=o;a=[],o[e]=ye}dt(a,R({rel:`modulepreload`,href:e},t)),i.bulkPreloads.add(a),Ba(n)}}else ve.m(e,t)}function mr(e,t,n){var r=Ui||null;if(r){var i=r.resumableState,a=r.renderState;if(e){t||=`default`;var o=a.styles.get(t),s=i.styleResources.hasOwnProperty(e)?i.styleResources[e]:void 0;s!==null&&(i.styleResources[e]=null,o||(o={precedence:I(V(t)),rules:[],hrefs:[],sheets:new Map},a.styles.set(t,o)),t={state:0,props:R({rel:`stylesheet`,href:e,"data-precedence":t},n)},s&&(s.length===2&&_r(t.props,s),(a=a.preloads.stylesheets.get(e))&&0<a.length?a.length=0:t.state=1),o.sheets.set(e,t),Ba(r))}}else ve.S(e,t,n)}function hr(e,t){var n=Ui||null;if(n){var r=n.resumableState,i=n.renderState;if(e){var a=r.scriptResources.hasOwnProperty(e)?r.scriptResources[e]:void 0;a!==null&&(r.scriptResources[e]=null,t=R({src:e,async:!0},t),a&&(a.length===2&&_r(t,a),e=i.preloads.scripts.get(e))&&(e.length=0),e=[],i.scripts.add(e),yt(e,t),Ba(n))}}else ve.X(e,t)}function gr(e,t){var n=Ui||null;if(n){var r=n.resumableState,i=n.renderState;if(e){var a=r.moduleScriptResources.hasOwnProperty(e)?r.moduleScriptResources[e]:void 0;a!==null&&(r.moduleScriptResources[e]=null,t=R({src:e,type:`module`,async:!0},t),a&&(a.length===2&&_r(t,a),e=i.preloads.moduleScripts.get(e))&&(e.length=0),e=[],i.scripts.add(e),yt(e,t),Ba(n))}}else ve.M(e,t)}function _r(e,t){e.crossOrigin??=t[0],e.integrity??=t[1]}function vr(e,t,n){for(var r in e=(``+e).replace(yr,br),t=(``+t).replace(xr,Sr),t=`<`+e+`>; rel=preload; as="`+t+`"`,n)z.call(n,r)&&(e=n[r],typeof e==`string`&&(t+=`; `+r.toLowerCase()+`="`+(``+e).replace(xr,Sr)+`"`));return t}var yr=/[<>\r\n]/g;function br(e){switch(e){case`<`:return`%3C`;case`>`:return`%3E`;case`
`:return`%0A`;case`\r`:return`%0D`;default:throw Error(`escapeLinkHrefForHeaderContextReplacer encountered a match it does not know how to replace. this means the match regex and the replacement characters are no longer in sync. This is a bug in React`)}}var xr=/["';,\r\n]/g;function Sr(e){switch(e){case`"`:return`%22`;case`'`:return`%27`;case`;`:return`%3B`;case`,`:return`%2C`;case`
`:return`%0A`;case`\r`:return`%0D`;default:throw Error(`escapeStringForLinkHeaderQuotedParamValueContextReplacer encountered a match it does not know how to replace. this means the match regex and the replacement characters are no longer in sync. This is a bug in React`)}}function Cr(e){this.styles.add(e)}function wr(e){this.stylesheets.add(e)}function Tr(e,t){t.styles.forEach(Cr,e),t.stylesheets.forEach(wr,e),t.suspenseyImages&&(e.suspenseyImages=!0)}function Er(e){return 0<e.stylesheets.size||e.suspenseyImages}var Dr=Function.prototype.bind,Or=Symbol.for(`react.client.reference`);function kr(e){if(e==null)return null;if(typeof e==`function`)return e.$$typeof===Or?null:e.displayName||e.name||null;if(typeof e==`string`)return e;switch(e){case c:return`Fragment`;case u:return`Profiler`;case l:return`StrictMode`;case m:return`Suspense`;case h:return`SuspenseList`;case y:return`Activity`}if(typeof e==`object`)switch(e.$$typeof){case s:return`Portal`;case f:return e.displayName||`Context`;case d:return(e._context.displayName||`Context`)+`.Consumer`;case p:var t=e.render;return e=e.displayName,e||=(e=t.displayName||t.name||``,e===``?`ForwardRef`:`ForwardRef(`+e+`)`),e;case g:return t=e.displayName||null,t===null?kr(e.type)||`Memo`:t;case _:t=e._payload,e=e._init;try{return kr(e(t))}catch{}}return null}var Ar={},jr=null;function Mr(e,t){if(e!==t){e.context._currentValue=e.parentValue,e=e.parent;var n=t.parent;if(e===null){if(n!==null)throw Error(a(401))}else{if(n===null)throw Error(a(401));Mr(e,n)}t.context._currentValue=t.value}}function Nr(e){e.context._currentValue=e.parentValue,e=e.parent,e!==null&&Nr(e)}function Pr(e){var t=e.parent;t!==null&&Pr(t),e.context._currentValue=e.value}function Fr(e,t){if(e.context._currentValue=e.parentValue,e=e.parent,e===null)throw Error(a(402));e.depth===t.depth?Mr(e,t):Fr(e,t)}function Ir(e,t){var n=t.parent;if(n===null)throw Error(a(402));e.depth===n.depth?Mr(e,n):Ir(e,n),t.context._currentValue=t.value}function Lr(e){var t=jr;t!==e&&(t===null?Pr(e):e===null?Nr(t):t.depth===e.depth?Mr(t,e):t.depth>e.depth?Fr(t,e):Ir(t,e),jr=e)}var Rr={enqueueSetState:function(e,t){e=e._reactInternals,e.queue!==null&&e.queue.push(t)},enqueueReplaceState:function(e,t){e=e._reactInternals,e.replace=!0,e.queue=[t]},enqueueForceUpdate:function(){}},zr={id:1,overflow:``};function Br(e,t,n){var r=e.id;e=e.overflow;var i=32-Vr(r)-1;r&=~(1<<i),n+=1;var a=32-Vr(t)+i;if(30<a){var o=i-i%5;return a=(r&(1<<o)-1).toString(32),r>>=o,i-=o,{id:1<<32-Vr(t)+i|n<<i|r,overflow:a+e}}return{id:1<<a|n<<i|r,overflow:e}}var Vr=Math.clz32?Math.clz32:Wr,Hr=Math.log,Ur=Math.LN2;function Wr(e){return e>>>=0,e===0?32:31-(Hr(e)/Ur|0)|0}function Gr(){}var Kr=Error(a(460));function qr(e,t,n){switch(n=e[n],n===void 0?e.push(t):n!==t&&(t.then(Gr,Gr),t=n),t.status){case`fulfilled`:return t.value;case`rejected`:throw t.reason;default:switch(typeof t.status==`string`?t.then(Gr,Gr):(e=t,e.status=`pending`,e.then(function(e){if(t.status===`pending`){var n=t;n.status=`fulfilled`,n.value=e}},function(e){if(t.status===`pending`){var n=t;n.status=`rejected`,n.reason=e}})),t.status){case`fulfilled`:return t.value;case`rejected`:throw t.reason}throw Jr=t,Kr}}var Jr=null;function Yr(){if(Jr===null)throw Error(a(459));var e=Jr;return Jr=null,e}function Xr(e,t){return e===t&&(e!==0||1/e==1/t)||e!==e&&t!==t}var Zr=typeof Object.is==`function`?Object.is:Xr,Qr=null,$r=null,ei=null,ti=null,ni=null,$=null,ri=!1,ii=!1,ai=0,oi=0,si=-1,ci=0,li=null,ui=null,di=0;function fi(){if(Qr===null)throw Error(a(321));return Qr}function pi(){if(0<di)throw Error(a(312));return{memoizedState:null,queue:null,next:null}}function mi(){return $===null?ni===null?(ri=!1,ni=$=pi()):(ri=!0,$=ni):$.next===null?(ri=!1,$=$.next=pi()):(ri=!0,$=$.next),$}function hi(){var e=li;return li=null,e}function gi(){ti=ei=$r=Qr=null,ii=!1,ni=null,di=0,$=ui=null}function _i(e,t){return typeof t==`function`?t(e):t}function vi(e,t,n){if(Qr=fi(),$=mi(),ri){var r=$.queue;if(t=r.dispatch,ui!==null&&(n=ui.get(r),n!==void 0)){ui.delete(r),r=$.memoizedState;do r=e(r,n.action),n=n.next;while(n!==null);return $.memoizedState=r,[r,t]}return[$.memoizedState,t]}return e=e===_i?typeof t==`function`?t():t:n===void 0?t:n(t),$.memoizedState=e,e=$.queue={last:null,dispatch:null},e=e.dispatch=bi.bind(null,Qr,e),[$.memoizedState,e]}function yi(e,t){if(Qr=fi(),$=mi(),t=t===void 0?null:t,$!==null){var n=$.memoizedState;if(n!==null&&t!==null){var r=n[1];a:if(r===null)r=!1;else{for(var i=0;i<r.length&&i<t.length;i++)if(!Zr(t[i],r[i])){r=!1;break a}r=!0}if(r)return n[0]}}return e=e(),$.memoizedState=[e,t],e}function bi(e,t,n){if(25<=di)throw Error(a(301));if(e===Qr)if(ii=!0,e={action:n,next:null},ui===null&&(ui=new Map),n=ui.get(t),n===void 0)ui.set(t,e);else{for(t=n;t.next!==null;)t=t.next;t.next=e}}function xi(){throw Error(a(440))}function Si(){throw Error(a(394))}function Ci(){throw Error(a(479))}function wi(e,t,n){fi();var r=oi++,i=ei;if(typeof e.$$FORM_ACTION==`function`){var a=null,o=ti;i=i.formState;var s=e.$$IS_SIGNATURE_EQUAL;if(i!==null&&typeof s==`function`){var c=i[1];s.call(e,i[2],i[3])&&(a=n===void 0?`k`+T(JSON.stringify([o,null,r]),0):`p`+n,c===a&&(si=r,t=i[0]))}var l=e.bind(null,t);return e=function(e){l(e)},typeof l.$$FORM_ACTION==`function`&&(e.$$FORM_ACTION=function(e){e=l.$$FORM_ACTION(e),n!==void 0&&(n+=``,e.action=n);var t=e.data;return t&&(a===null&&(a=n===void 0?`k`+T(JSON.stringify([o,null,r]),0):`p`+n),t.append(`$ACTION_KEY`,a)),e}),[t,e,!1]}var u=e.bind(null,t);return[t,function(e){u(e)},!1]}function Ti(e){var t=ci;return ci+=1,li===null&&(li=[]),qr(li,e,t)}function Ei(){throw Error(a(393))}var Di={readContext:function(e){return e._currentValue},use:function(e){if(typeof e==`object`&&e){if(typeof e.then==`function`)return Ti(e);if(e.$$typeof===f)return e._currentValue}throw Error(a(438,String(e)))},useContext:function(e){return fi(),e._currentValue},useMemo:yi,useReducer:vi,useRef:function(e){Qr=fi(),$=mi();var t=$.memoizedState;return t===null?(e={current:e},$.memoizedState=e):t},useState:function(e){return vi(_i,e)},useInsertionEffect:Gr,useLayoutEffect:Gr,useCallback:function(e,t){return yi(function(){return e},t)},useImperativeHandle:Gr,useEffect:Gr,useDebugValue:Gr,useDeferredValue:function(e,t){return fi(),t===void 0?e:t},useTransition:function(){return fi(),[!1,Si]},useId:function(){var e=$r.treeContext,t=e.overflow;e=e.id,e=(e&~(1<<32-Vr(e)-1)).toString(32)+t;var n=Oi;if(n===null)throw Error(a(404));return t=ai++,e=`_`+n.idPrefix+`R_`+e,0<t&&(e+=`H`+t.toString(32)),e+`_`},useSyncExternalStore:function(e,t,n){if(n===void 0)throw Error(a(407));return n()},useOptimistic:function(e){return fi(),[e,Ci]},useActionState:wi,useFormState:wi,useHostTransitionStatus:function(){return fi(),_e},useMemoCache:function(e){for(var t=Array(e),n=0;n<e;n++)t[n]=x;return t},useCacheRefresh:function(){return Ei},useEffectEvent:function(){return xi}},Oi=null,ki={getCacheForType:function(){throw Error(a(248))},cacheSignal:function(){throw Error(a(248))}},Ai,ji;function Mi(e){if(Ai===void 0)try{throw Error()}catch(e){var t=e.stack.trim().match(/\n( *(at )?)/);Ai=t&&t[1]||``,ji=-1<e.stack.indexOf(`
    at`)?` (<anonymous>)`:-1<e.stack.indexOf(`@`)?`@unknown:0:0`:``}return`
`+Ai+e+ji}var Ni=!1;function Pi(e,t){if(!e||Ni)return``;Ni=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var r={DetermineComponentFrameRoot:function(){try{if(t){var n=function(){throw Error()};if(Object.defineProperty(n.prototype,"props",{set:function(){throw Error()}}),typeof Reflect==`object`&&Reflect.construct){try{Reflect.construct(n,[])}catch(e){var r=e}Reflect.construct(e,[],n)}else{try{n.call()}catch(e){r=e}e.call(n.prototype)}}else{try{throw Error()}catch(e){r=e}(n=e())&&typeof n.catch==`function`&&n.catch(function(){})}}catch(e){if(e&&r&&typeof e.stack==`string`)return[e.stack,r.stack]}return[null,null]}};r.DetermineComponentFrameRoot.displayName=`DetermineComponentFrameRoot`;var i=Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot,`name`);i&&i.configurable&&Object.defineProperty(r.DetermineComponentFrameRoot,"name",{value:`DetermineComponentFrameRoot`});var a=r.DetermineComponentFrameRoot(),o=a[0],s=a[1];if(o&&s){var c=o.split(`
`),l=s.split(`
`);for(i=r=0;r<c.length&&!c[r].includes(`DetermineComponentFrameRoot`);)r++;for(;i<l.length&&!l[i].includes(`DetermineComponentFrameRoot`);)i++;if(r===c.length||i===l.length)for(r=c.length-1,i=l.length-1;1<=r&&0<=i&&c[r]!==l[i];)i--;for(;1<=r&&0<=i;r--,i--)if(c[r]!==l[i]){if(r!==1||i!==1)do if(r--,i--,0>i||c[r]!==l[i]){var u=`
`+c[r].replace(` at new `,` at `);return e.displayName&&u.includes(`<anonymous>`)&&(u=u.replace(`<anonymous>`,e.displayName)),u}while(1<=r&&0<=i);break}}}finally{Ni=!1,Error.prepareStackTrace=n}return(n=e?e.displayName||e.name:``)?Mi(n):``}function Fi(e){if(typeof e==`string`)return Mi(e);if(typeof e==`function`)return e.prototype&&e.prototype.isReactComponent?Pi(e,!0):Pi(e,!1);if(typeof e==`object`&&e){switch(e.$$typeof){case p:return Pi(e.render,!1);case g:return Pi(e.type,!1);case _:var t=e,n=t._payload;t=t._init;try{e=t(n)}catch{return Mi(`Lazy`)}return Fi(e)}if(typeof e.name==`string`){a:{n=e.name,t=e.env;var r=e.debugLocation;if(r!=null&&(e=Error.prepareStackTrace,Error.prepareStackTrace=void 0,r=r.stack,Error.prepareStackTrace=e,r.startsWith(`Error: react-stack-top-frame
`)&&(r=r.slice(29)),e=r.indexOf(`
`),e!==-1&&(r=r.slice(e+1)),e=r.indexOf(`react_stack_bottom_frame`),e!==-1&&(e=r.lastIndexOf(`
`,e)),e=e===-1?``:r=r.slice(0,e),r=e.lastIndexOf(`
`),e=r===-1?e:e.slice(r+1),e.indexOf(n)!==-1)){n=`
`+e;break a}n=Mi(n+(t?` [`+t+`]`:``))}return n}}switch(e){case h:return Mi(`SuspenseList`);case m:return Mi(`Suspense`)}return``}function Ii(e,t){return(500<t.byteSize||Er(t.contentState))&&t.contentPreamble===null}function Li(e){if(typeof e==`object`&&e&&typeof e.environmentName==`string`){var t=e.environmentName;e=[e].slice(0),typeof e[0]==`string`?e.splice(0,1,`%c%s%c `+e[0],`background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px`,` `+t+` `,``):e.splice(0,0,`%c%s%c`,`background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px`,` `+t+` `,``),e.unshift(console),t=Dr.apply(console.error,e),t()}else console.error(e);return null}function Ri(e,t,n,r,i,a,o,s,c,l,u){var d=new Set;this.destination=null,this.flushScheduled=!1,this.resumableState=e,this.renderState=t,this.rootFormatContext=n,this.progressiveChunkSize=r===void 0?12800:r,this.status=10,this.fatalError=null,this.pendingRootTasks=this.allPendingTasks=this.nextSegmentId=0,this.completedPreambleSegments=this.completedRootSegment=null,this.byteSize=0,this.abortableTasks=d,this.pingedTasks=[],this.clientRenderedBoundaries=[],this.completedBoundaries=[],this.partialBoundaries=[],this.trackedPostpones=null,this.onError=i===void 0?Li:i,this.onPostpone=l===void 0?Gr:l,this.onAllReady=a===void 0?Gr:a,this.onShellReady=o===void 0?Gr:o,this.onShellError=s===void 0?Gr:s,this.onFatalError=c===void 0?Gr:c,this.formState=u===void 0?null:u}function zi(e,t,n,r,i,a,o,s,c,l,u,d){return t=new Ri(t,n,r,i,a,o,s,c,l,u,d),n=Ji(t,0,null,r,!1,!1),n.parentFlushed=!0,e=Ki(t,null,e,-1,null,n,null,null,t.abortableTasks,null,r,null,zr,null,null),Yi(e),t.pingedTasks.push(e),t}function Bi(e,t,n,r,i,a,o,s,c,l,u){return e=zi(e,t,n,r,i,a,o,s,c,l,u,void 0),e.trackedPostpones={workingMap:new Map,rootNodes:[],rootSlots:null},e}function Vi(e,t,n,r,i,a,o,s,c){return n=new Ri(t.resumableState,n,t.rootFormatContext,t.progressiveChunkSize,r,i,a,o,s,c,null),n.nextSegmentId=t.nextSegmentId,typeof t.replaySlots==`number`?(r=Ji(n,0,null,t.rootFormatContext,!1,!1),r.parentFlushed=!0,e=Ki(n,null,e,-1,null,r,null,null,n.abortableTasks,null,t.rootFormatContext,null,zr,null,null),Yi(e),n.pingedTasks.push(e),n):(e=qi(n,null,{nodes:t.replayNodes,slots:t.replaySlots,pendingTasks:0},e,-1,null,null,n.abortableTasks,null,t.rootFormatContext,null,zr,null,null),Yi(e),n.pingedTasks.push(e),n)}function Hi(e,t,n,r,i,a,o,s,c){return e=Vi(e,t,n,r,i,a,o,s,c),e.trackedPostpones={workingMap:new Map,rootNodes:[],rootSlots:null},e}var Ui=null;function Wi(e,t){e.pingedTasks.push(t),e.pingedTasks.length===1&&(e.flushScheduled=e.destination!==null,e.trackedPostpones!==null||e.status===10?j(function(){return Da(e)}):O(function(){return Da(e)}))}function Gi(e,t,n,r,i){return n={status:0,rootSegmentID:-1,parentFlushed:!1,pendingTasks:0,row:t,completedSegments:[],byteSize:0,fallbackAbortableTasks:n,errorDigest:null,contentState:lr(),fallbackState:lr(),contentPreamble:r,fallbackPreamble:i,trackedContentKeyPath:null,trackedFallbackNode:null},t!==null&&(t.pendingTasks++,r=t.boundaries,r!==null&&(e.allPendingTasks++,n.pendingTasks++,r.push(n)),e=t.inheritedHoistables,e!==null&&Tr(n.contentState,e)),n}function Ki(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m){e.allPendingTasks++,i===null?e.pendingRootTasks++:i.pendingTasks++,p!==null&&p.pendingTasks++;var h={replay:null,node:n,childIndex:r,ping:function(){return Wi(e,h)},blockedBoundary:i,blockedSegment:a,blockedPreamble:o,hoistableState:s,abortSet:c,keyPath:l,formatContext:u,context:d,treeContext:f,row:p,componentStack:m,thenableState:t};return c.add(h),h}function qi(e,t,n,r,i,a,o,s,c,l,u,d,f,p){e.allPendingTasks++,a===null?e.pendingRootTasks++:a.pendingTasks++,f!==null&&f.pendingTasks++,n.pendingTasks++;var m={replay:n,node:r,childIndex:i,ping:function(){return Wi(e,m)},blockedBoundary:a,blockedSegment:null,blockedPreamble:null,hoistableState:o,abortSet:s,keyPath:c,formatContext:l,context:u,treeContext:d,row:f,componentStack:p,thenableState:t};return s.add(m),m}function Ji(e,t,n,r,i,a){return{status:0,parentFlushed:!1,id:-1,index:t,chunks:[],children:[],preambleChildren:[],parentFormatContext:r,boundary:n,lastPushedText:i,textEmbedded:a}}function Yi(e){var t=e.node;if(typeof t==`object`&&t)switch(t.$$typeof){case o:e.componentStack={parent:e.componentStack,type:t.type}}}function Xi(e){return e===null?null:{parent:e.parent,type:`Suspense Fallback`}}function Zi(e){var t={};return e&&Object.defineProperty(t,"componentStack",{configurable:!0,enumerable:!0,get:function(){try{var n=``,r=e;do n+=Fi(r.type),r=r.parent;while(r);var i=n}catch(e){i=`
Error generating stack: `+e.message+`
`+e.stack}return Object.defineProperty(t,"componentStack",{value:i}),i}}),t}function Qi(e,t,n){if(e=e.onError,t=e(t,n),t==null||typeof t==`string`)return t}function $i(e,t){var n=e.onShellError,r=e.onFatalError;n(t),r(t),e.destination===null?(e.status=13,e.fatalError=t):(e.status=14,ie(e.destination,t))}function ea(e,t){ta(e,t.next,t.hoistables)}function ta(e,t,n){for(;t!==null;){n!==null&&(Tr(t.hoistables,n),t.inheritedHoistables=n);var r=t.boundaries;if(r!==null){t.boundaries=null;for(var i=0;i<r.length;i++){var a=r[i];n!==null&&Tr(a.contentState,n),Ea(e,a,null,null)}}if(t.pendingTasks--,0<t.pendingTasks)break;n=t.hoistables,t=t.next}}function na(e,t){var n=t.boundaries;if(n!==null&&t.pendingTasks===n.length){for(var r=!0,i=0;i<n.length;i++){var a=n[i];if(a.pendingTasks!==1||a.parentFlushed||Ii(e,a)){r=!1;break}}r&&ta(e,t,t.hoistables)}}function ra(e){var t={pendingTasks:1,boundaries:null,hoistables:lr(),inheritedHoistables:null,together:!1,next:null};return e!==null&&0<e.pendingTasks&&(t.pendingTasks++,t.boundaries=[],e.next=t),t}function ia(e,t,n,r,i){var a=t.keyPath,o=t.treeContext,s=t.row;t.keyPath=n,n=r.length;var c=null;if(t.replay!==null){var l=t.replay.slots;if(typeof l==`object`&&l)for(var u=0;u<n;u++){var d=i!==`backwards`&&i!==`unstable_legacy-backwards`?u:n-1-u,f=r[d];t.row=c=ra(c),t.treeContext=Br(o,n,d);var p=l[d];typeof p==`number`?(ca(e,t,p,f,d),delete l[d]):_a(e,t,f,d),--c.pendingTasks===0&&ea(e,c)}else for(l=0;l<n;l++)u=i!==`backwards`&&i!==`unstable_legacy-backwards`?l:n-1-l,d=r[u],t.row=c=ra(c),t.treeContext=Br(o,n,u),_a(e,t,d,u),--c.pendingTasks===0&&ea(e,c)}else if(i!==`backwards`&&i!==`unstable_legacy-backwards`)for(i=0;i<n;i++)l=r[i],t.row=c=ra(c),t.treeContext=Br(o,n,i),_a(e,t,l,i),--c.pendingTasks===0&&ea(e,c);else{for(i=t.blockedSegment,l=i.children.length,u=i.chunks.length,d=n-1;0<=d;d--){f=r[d],t.row=c=ra(c),t.treeContext=Br(o,n,d),p=Ji(e,u,null,t.formatContext,d!==0||i.lastPushedText,!0),i.children.splice(l,0,p),t.blockedSegment=p;try{_a(e,t,f,d),p.lastPushedText&&p.textEmbedded&&p.chunks.push(Be),p.status=1,Ta(e,t.blockedBoundary,p),--c.pendingTasks===0&&ea(e,c)}catch(t){throw p.status=e.status===12?3:4,t}}t.blockedSegment=i,i.lastPushedText=!1}s!==null&&c!==null&&0<c.pendingTasks&&(s.pendingTasks++,c.next=s),t.treeContext=o,t.row=s,t.keyPath=a}function aa(e,t,n,r,i,a){var o=t.thenableState;for(t.thenableState=null,Qr={},$r=t,ei=e,ti=n,oi=ai=0,si=-1,ci=0,li=o,e=r(i,a);ii;)ii=!1,oi=ai=0,si=-1,ci=0,di+=1,$=null,e=r(i,a);return gi(),e}function oa(e,t,n,r,i,a,o){var s=!1;if(a!==0&&e.formState!==null){var c=t.blockedSegment;if(c!==null){s=!0,c=c.chunks;for(var l=0;l<a;l++)l===o?c.push(lt):c.push(ut)}}a=t.keyPath,t.keyPath=n,i?(n=t.treeContext,t.treeContext=Br(n,1,0),_a(e,t,r,-1),t.treeContext=n):s?_a(e,t,r,-1):la(e,t,r,-1),t.keyPath=a}function sa(e,t,n,r,i,o){if(typeof r==`function`)if(r.prototype&&r.prototype.isReactComponent){var s=i;if(`ref`in i)for(var x in s={},i)x!==`ref`&&(s[x]=i[x]);var C=r.defaultProps;if(C)for(var T in s===i&&(s=R({},s,i)),C)s[T]===void 0&&(s[T]=C[T]);i=s,s=Ar,C=r.contextType,typeof C==`object`&&C&&(s=C._currentValue),s=new r(i,s);var E=s.state===void 0?null:s.state;if(s.updater=Rr,s.props=i,s.state=E,C={queue:[],replace:!1},s._reactInternals=C,o=r.contextType,s.context=typeof o==`object`&&o?o._currentValue:Ar,o=r.getDerivedStateFromProps,typeof o==`function`&&(o=o(i,E),E=o==null?E:R({},E,o),s.state=E),typeof r.getDerivedStateFromProps!=`function`&&typeof s.getSnapshotBeforeUpdate!=`function`&&(typeof s.UNSAFE_componentWillMount==`function`||typeof s.componentWillMount==`function`))if(r=s.state,typeof s.componentWillMount==`function`&&s.componentWillMount(),typeof s.UNSAFE_componentWillMount==`function`&&s.UNSAFE_componentWillMount(),r!==s.state&&Rr.enqueueReplaceState(s,s.state,null),C.queue!==null&&0<C.queue.length)if(r=C.queue,o=C.replace,C.queue=null,C.replace=!1,o&&r.length===1)s.state=r[0];else{for(C=o?r[0]:s.state,E=!0,o=+!!o;o<r.length;o++)T=r[o],T=typeof T==`function`?T.call(s,C,i,void 0):T,T!=null&&(E?(E=!1,C=R({},C,T)):R(C,T));s.state=C}else C.queue=null;if(r=s.render(),e.status===12)throw null;i=t.keyPath,t.keyPath=n,la(e,t,r,-1),t.keyPath=i}else{if(r=aa(e,t,n,r,i,void 0),e.status===12)throw null;oa(e,t,n,r,ai!==0,oi,si)}else if(typeof r==`string`)if(s=t.blockedSegment,s===null)s=i.children,C=t.formatContext,E=t.keyPath,t.formatContext=Ie(C,r,i),t.keyPath=n,_a(e,t,s,-1),t.formatContext=C,t.keyPath=E;else{if(E=Dt(s.chunks,r,i,e.resumableState,e.renderState,t.blockedPreamble,t.hoistableState,t.formatContext,s.lastPushedText),s.lastPushedText=!1,C=t.formatContext,o=t.keyPath,t.keyPath=n,(t.formatContext=Ie(C,r,i)).insertionMode===3){n=Ji(e,0,null,t.formatContext,!1,!1),s.preambleChildren.push(n),t.blockedSegment=n;try{n.status=6,_a(e,t,E,-1),n.lastPushedText&&n.textEmbedded&&n.chunks.push(Be),n.status=1,Ta(e,t.blockedBoundary,n)}finally{t.blockedSegment=s}}else _a(e,t,E,-1);t.formatContext=C,t.keyPath=o;a:{switch(t=s.chunks,e=e.resumableState,r){case`title`:case`style`:case`script`:case`area`:case`base`:case`br`:case`col`:case`embed`:case`hr`:case`img`:case`input`:case`keygen`:case`link`:case`meta`:case`param`:case`source`:case`track`:case`wbr`:break a;case`body`:if(1>=C.insertionMode){e.hasBody=!0;break a}break;case`html`:if(C.insertionMode===0){e.hasHtml=!0;break a}break;case`head`:if(1>=C.insertionMode)break a}t.push(kt(r))}s.lastPushedText=!1}else{switch(r){case b:case l:case u:case c:r=t.keyPath,t.keyPath=n,la(e,t,i.children,-1),t.keyPath=r;return;case y:r=t.blockedSegment,r===null?i.mode!==`hidden`&&(r=t.keyPath,t.keyPath=n,_a(e,t,i.children,-1),t.keyPath=r):i.mode!==`hidden`&&(r.chunks.push(Ft),r.lastPushedText=!1,s=t.keyPath,t.keyPath=n,_a(e,t,i.children,-1),t.keyPath=s,r.chunks.push(It),r.lastPushedText=!1);return;case h:a:{if(r=i.children,i=i.revealOrder,i===`forwards`||i===`backwards`||i===`unstable_legacy-backwards`){if(w(r)){ia(e,t,n,r,i);break a}if((s=ee(r))&&(s=s.call(r))){if(C=s.next(),!C.done){do C=s.next();while(!C.done);ia(e,t,n,r,i)}break a}}i===`together`?(i=t.keyPath,s=t.row,C=t.row=ra(null),C.boundaries=[],C.together=!0,t.keyPath=n,la(e,t,r,-1),--C.pendingTasks===0&&ea(e,C),t.keyPath=i,t.row=s,s!==null&&0<C.pendingTasks&&(s.pendingTasks++,C.next=s)):(i=t.keyPath,t.keyPath=n,la(e,t,r,-1),t.keyPath=i)}return;case S:case v:throw Error(a(343));case m:a:if(t.replay!==null){r=t.keyPath,s=t.formatContext,C=t.row,t.keyPath=n,t.formatContext=ze(e.resumableState,s),t.row=null,n=i.children;try{_a(e,t,n,-1)}finally{t.keyPath=r,t.formatContext=s,t.row=C}}else{r=t.keyPath,o=t.formatContext;var D=t.row;T=t.blockedBoundary,x=t.blockedPreamble;var O=t.hoistableState,k=t.blockedSegment,A=i.fallback;i=i.children;var j=new Set,M=2>t.formatContext.insertionMode?Gi(e,t.row,j,U(),U()):Gi(e,t.row,j,null,null);e.trackedPostpones!==null&&(M.trackedContentKeyPath=n);var N=Ji(e,k.chunks.length,M,t.formatContext,!1,!1);k.children.push(N),k.lastPushedText=!1;var P=Ji(e,0,null,t.formatContext,!1,!1);if(P.parentFlushed=!0,e.trackedPostpones!==null){s=t.componentStack,C=[n[0],`Suspense Fallback`,n[2]],E=[C[1],C[2],[],null],e.trackedPostpones.workingMap.set(C,E),M.trackedFallbackNode=E,t.blockedSegment=N,t.blockedPreamble=M.fallbackPreamble,t.keyPath=C,t.formatContext=Re(e.resumableState,o),t.componentStack=Xi(s),N.status=6;try{_a(e,t,A,-1),N.lastPushedText&&N.textEmbedded&&N.chunks.push(Be),N.status=1,Ta(e,T,N)}catch(t){throw N.status=e.status===12?3:4,t}finally{t.blockedSegment=k,t.blockedPreamble=x,t.keyPath=r,t.formatContext=o}t=Ki(e,null,i,-1,M,P,M.contentPreamble,M.contentState,t.abortSet,n,ze(e.resumableState,t.formatContext),t.context,t.treeContext,null,s),Yi(t),e.pingedTasks.push(t)}else{t.blockedBoundary=M,t.blockedPreamble=M.contentPreamble,t.hoistableState=M.contentState,t.blockedSegment=P,t.keyPath=n,t.formatContext=ze(e.resumableState,o),t.row=null,P.status=6;try{if(_a(e,t,i,-1),P.lastPushedText&&P.textEmbedded&&P.chunks.push(Be),P.status=1,Ta(e,M,P),wa(M,P),M.pendingTasks===0&&M.status===0){if(M.status=1,!Ii(e,M)){D!==null&&--D.pendingTasks===0&&ea(e,D),e.pendingRootTasks===0&&t.blockedPreamble&&Aa(e);break a}}else D!==null&&D.together&&na(e,D)}catch(n){M.status=4,e.status===12?(P.status=3,s=e.fatalError):(P.status=4,s=n),C=Zi(t.componentStack),E=Qi(e,s,C),M.errorDigest=E,ma(e,M)}finally{t.blockedBoundary=T,t.blockedPreamble=x,t.hoistableState=O,t.blockedSegment=k,t.keyPath=r,t.formatContext=o,t.row=D}t=Ki(e,null,A,-1,T,N,M.fallbackPreamble,M.fallbackState,j,[n[0],`Suspense Fallback`,n[2]],Re(e.resumableState,t.formatContext),t.context,t.treeContext,t.row,Xi(t.componentStack)),Yi(t),e.pingedTasks.push(t)}}return}if(typeof r==`object`&&r)switch(r.$$typeof){case p:if(`ref`in i)for(k in s={},i)k!==`ref`&&(s[k]=i[k]);else s=i;r=aa(e,t,n,r.render,s,o),oa(e,t,n,r,ai!==0,oi,si);return;case g:sa(e,t,n,r.type,i,o);return;case f:if(C=i.children,s=t.keyPath,i=i.value,E=r._currentValue,r._currentValue=i,o=jr,jr=r={parent:o,depth:o===null?0:o.depth+1,context:r,parentValue:E,value:i},t.context=r,t.keyPath=n,la(e,t,C,-1),e=jr,e===null)throw Error(a(403));e.context._currentValue=e.parentValue,e=jr=e.parent,t.context=e,t.keyPath=s;return;case d:i=i.children,r=i(r._context._currentValue),i=t.keyPath,t.keyPath=n,la(e,t,r,-1),t.keyPath=i;return;case _:if(s=r._init,r=s(r._payload),e.status===12)throw null;sa(e,t,n,r,i,o);return}throw Error(a(130,r==null?r:typeof r,``))}}function ca(e,t,n,r,i){var a=t.replay,o=t.blockedBoundary,s=Ji(e,0,null,t.formatContext,!1,!1);s.id=n,s.parentFlushed=!0;try{t.replay=null,t.blockedSegment=s,_a(e,t,r,i),s.status=1,Ta(e,o,s),o===null?e.completedRootSegment=s:(wa(o,s),o.parentFlushed&&e.partialBoundaries.push(o))}finally{t.replay=a,t.blockedSegment=null}}function la(e,t,n,r){t.replay!==null&&typeof t.replay.slots==`number`?ca(e,t,t.replay.slots,n,r):(t.node=n,t.childIndex=r,n=t.componentStack,Yi(t),ua(e,t),t.componentStack=n)}function ua(e,t){var n=t.node,r=t.childIndex;if(n!==null){if(typeof n==`object`){switch(n.$$typeof){case o:var i=n.type,c=n.key,l=n.props;n=l.ref;var u=n===void 0?null:n,d=kr(i),p=c??(r===-1?0:r);if(c=[t.keyPath,d,p],t.replay!==null)a:{var h=t.replay;for(r=h.nodes,n=0;n<r.length;n++){var g=r[n];if(p===g[1]){if(g.length===4){if(d!==null&&d!==g[0])throw Error(a(490,g[0],d));var v=g[2];d=g[3],p=t.node,t.replay={nodes:v,slots:d,pendingTasks:1};try{if(sa(e,t,c,i,l,u),t.replay.pendingTasks===1&&0<t.replay.nodes.length)throw Error(a(488));t.replay.pendingTasks--}catch(a){if(typeof a==`object`&&a&&(a===Kr||typeof a.then==`function`))throw t.node===p?t.replay=h:r.splice(n,1),a;t.replay.pendingTasks--,l=Zi(t.componentStack),c=e,e=t.blockedBoundary,i=a,l=Qi(c,i,l),ya(c,e,v,d,i,l)}t.replay=h}else{if(i!==m)throw Error(a(490,`Suspense`,kr(i)||`Unknown`));b:{h=void 0,i=g[5],u=g[2],d=g[3],p=g[4]===null?[]:g[4][2],g=g[4]===null?null:g[4][3];var y=t.keyPath,b=t.formatContext,x=t.row,S=t.replay,C=t.blockedBoundary,T=t.hoistableState,E=l.children,D=l.fallback,O=new Set;l=2>t.formatContext.insertionMode?Gi(e,t.row,O,U(),U()):Gi(e,t.row,O,null,null),l.parentFlushed=!0,l.rootSegmentID=i,t.blockedBoundary=l,t.hoistableState=l.contentState,t.keyPath=c,t.formatContext=ze(e.resumableState,b),t.row=null,t.replay={nodes:u,slots:d,pendingTasks:1};try{if(_a(e,t,E,-1),t.replay.pendingTasks===1&&0<t.replay.nodes.length)throw Error(a(488));if(t.replay.pendingTasks--,l.pendingTasks===0&&l.status===0){l.status=1,e.completedBoundaries.push(l);break b}}catch(n){l.status=4,v=Zi(t.componentStack),h=Qi(e,n,v),l.errorDigest=h,t.replay.pendingTasks--,e.clientRenderedBoundaries.push(l)}finally{t.blockedBoundary=C,t.hoistableState=T,t.replay=S,t.keyPath=y,t.formatContext=b,t.row=x}v=qi(e,null,{nodes:p,slots:g,pendingTasks:0},D,-1,C,l.fallbackState,O,[c[0],`Suspense Fallback`,c[2]],Re(e.resumableState,t.formatContext),t.context,t.treeContext,t.row,Xi(t.componentStack)),Yi(v),e.pingedTasks.push(v)}}r.splice(n,1);break a}}}else sa(e,t,c,i,l,u);return;case s:throw Error(a(257));case _:if(v=n._init,n=v(n._payload),e.status===12)throw null;la(e,t,n,r);return}if(w(n)){da(e,t,n,r);return}if((v=ee(n))&&(v=v.call(n))){if(n=v.next(),!n.done){l=[];do l.push(n.value),n=v.next();while(!n.done);da(e,t,l,r)}return}if(typeof n.then==`function`)return t.thenableState=null,la(e,t,Ti(n),r);if(n.$$typeof===f)return la(e,t,n._currentValue,r);throw r=Object.prototype.toString.call(n),Error(a(31,r===`[object Object]`?`object with keys {`+Object.keys(n).join(`, `)+`}`:r))}typeof n==`string`?(r=t.blockedSegment,r!==null&&(r.lastPushedText=Ve(r.chunks,n,e.renderState,r.lastPushedText))):(typeof n==`number`||typeof n==`bigint`)&&(r=t.blockedSegment,r!==null&&(r.lastPushedText=Ve(r.chunks,``+n,e.renderState,r.lastPushedText)))}}function da(e,t,n,r){var i=t.keyPath;if(r!==-1&&(t.keyPath=[t.keyPath,`Fragment`,r],t.replay!==null)){for(var o=t.replay,s=o.nodes,c=0;c<s.length;c++){var l=s[c];if(l[1]===r){r=l[2],l=l[3],t.replay={nodes:r,slots:l,pendingTasks:1};try{if(da(e,t,n,-1),t.replay.pendingTasks===1&&0<t.replay.nodes.length)throw Error(a(488));t.replay.pendingTasks--}catch(i){if(typeof i==`object`&&i&&(i===Kr||typeof i.then==`function`))throw i;t.replay.pendingTasks--,n=Zi(t.componentStack);var u=t.blockedBoundary,d=i;n=Qi(e,d,n),ya(e,u,r,l,d,n)}t.replay=o,s.splice(c,1);break}}t.keyPath=i;return}if(o=t.treeContext,s=n.length,t.replay!==null&&(c=t.replay.slots,typeof c==`object`&&c)){for(r=0;r<s;r++)l=n[r],t.treeContext=Br(o,s,r),u=c[r],typeof u==`number`?(ca(e,t,u,l,r),delete c[r]):_a(e,t,l,r);t.treeContext=o,t.keyPath=i;return}for(c=0;c<s;c++)r=n[c],t.treeContext=Br(o,s,c),_a(e,t,r,c);t.treeContext=o,t.keyPath=i}function fa(e,t,n){if(n.status=5,n.rootSegmentID=e.nextSegmentId++,e=n.trackedContentKeyPath,e===null)throw Error(a(486));var r=n.trackedFallbackNode,i=[],o=t.workingMap.get(e);return o===void 0?(n=[e[1],e[2],i,null,r,n.rootSegmentID],t.workingMap.set(e,n),Ua(n,e[0],t),n):(o[4]=r,o[5]=n.rootSegmentID,o)}function pa(e,t,n,r){r.status=5;var i=n.keyPath,o=n.blockedBoundary;if(o===null)r.id=e.nextSegmentId++,t.rootSlots=r.id,e.completedRootSegment!==null&&(e.completedRootSegment.status=5);else{if(o!==null&&o.status===0){var s=fa(e,t,o);if(o.trackedContentKeyPath===i&&n.childIndex===-1){r.id===-1&&(r.id=r.parentFlushed?o.rootSegmentID:e.nextSegmentId++),s[3]=r.id;return}}if(r.id===-1&&(r.id=r.parentFlushed&&o!==null?o.rootSegmentID:e.nextSegmentId++),n.childIndex===-1)i===null?t.rootSlots=r.id:(n=t.workingMap.get(i),n===void 0?(n=[i[1],i[2],[],r.id],Ua(n,i[0],t)):n[3]=r.id);else{if(i===null){if(e=t.rootSlots,e===null)e=t.rootSlots={};else if(typeof e==`number`)throw Error(a(491))}else if(o=t.workingMap,s=o.get(i),s===void 0)e={},s=[i[1],i[2],[],e],o.set(i,s),Ua(s,i[0],t);else if(e=s[3],e===null)e=s[3]={};else if(typeof e==`number`)throw Error(a(491));e[n.childIndex]=r.id}}}function ma(e,t){e=e.trackedPostpones,e!==null&&(t=t.trackedContentKeyPath,t!==null&&(t=e.workingMap.get(t),t!==void 0&&(t.length=4,t[2]=[],t[3]=null)))}function ha(e,t,n){return qi(e,n,t.replay,t.node,t.childIndex,t.blockedBoundary,t.hoistableState,t.abortSet,t.keyPath,t.formatContext,t.context,t.treeContext,t.row,t.componentStack)}function ga(e,t,n){var r=t.blockedSegment,i=Ji(e,r.chunks.length,null,t.formatContext,r.lastPushedText,!0);return r.children.push(i),r.lastPushedText=!1,Ki(e,n,t.node,t.childIndex,t.blockedBoundary,i,t.blockedPreamble,t.hoistableState,t.abortSet,t.keyPath,t.formatContext,t.context,t.treeContext,t.row,t.componentStack)}function _a(e,t,n,r){var i=t.formatContext,a=t.context,o=t.keyPath,s=t.treeContext,c=t.componentStack,l=t.blockedSegment;if(l===null){l=t.replay;try{return la(e,t,n,r)}catch(u){if(gi(),n=u===Kr?Yr():u,e.status!==12&&typeof n==`object`&&n){if(typeof n.then==`function`){r=u===Kr?hi():null,e=ha(e,t,r).ping,n.then(e,e),t.formatContext=i,t.context=a,t.keyPath=o,t.treeContext=s,t.componentStack=c,t.replay=l,Lr(a);return}if(n.message===`Maximum call stack size exceeded`){n=u===Kr?hi():null,n=ha(e,t,n),e.pingedTasks.push(n),t.formatContext=i,t.context=a,t.keyPath=o,t.treeContext=s,t.componentStack=c,t.replay=l,Lr(a);return}}}}else{var u=l.children.length,d=l.chunks.length;try{return la(e,t,n,r)}catch(r){if(gi(),l.children.length=u,l.chunks.length=d,n=r===Kr?Yr():r,e.status!==12&&typeof n==`object`&&n){if(typeof n.then==`function`){l=n,n=r===Kr?hi():null,e=ga(e,t,n).ping,l.then(e,e),t.formatContext=i,t.context=a,t.keyPath=o,t.treeContext=s,t.componentStack=c,Lr(a);return}if(n.message===`Maximum call stack size exceeded`){l=r===Kr?hi():null,l=ga(e,t,l),e.pingedTasks.push(l),t.formatContext=i,t.context=a,t.keyPath=o,t.treeContext=s,t.componentStack=c,Lr(a);return}}}}throw t.formatContext=i,t.context=a,t.keyPath=o,t.treeContext=s,Lr(a),n}function va(e){var t=e.blockedBoundary,n=e.blockedSegment;n!==null&&(n.status=3,Ea(this,t,e.row,n))}function ya(e,t,n,r,i,o){for(var s=0;s<n.length;s++){var c=n[s];if(c.length===4)ya(e,t,c[2],c[3],i,o);else{c=c[5];var l=e,u=o,d=Gi(l,null,new Set,null,null);d.parentFlushed=!0,d.rootSegmentID=c,d.status=4,d.errorDigest=u,d.parentFlushed&&l.clientRenderedBoundaries.push(d)}}if(n.length=0,r!==null){if(t===null)throw Error(a(487));if(t.status!==4&&(t.status=4,t.errorDigest=o,t.parentFlushed&&e.clientRenderedBoundaries.push(t)),typeof r==`object`)for(var f in r)delete r[f]}}function ba(e,t,n){var r=e.blockedBoundary,i=e.blockedSegment;if(i!==null){if(i.status===6)return;i.status=3}var a=Zi(e.componentStack);if(r===null){if(t.status!==13&&t.status!==14){if(r=e.replay,r===null){t.trackedPostpones!==null&&i!==null?(r=t.trackedPostpones,Qi(t,n,a),pa(t,r,e,i),Ea(t,null,e.row,i)):(Qi(t,n,a),$i(t,n));return}r.pendingTasks--,r.pendingTasks===0&&0<r.nodes.length&&(i=Qi(t,n,a),ya(t,null,r.nodes,r.slots,n,i)),t.pendingRootTasks--,t.pendingRootTasks===0&&Sa(t)}}else{var o=t.trackedPostpones;if(r.status!==4){if(o!==null&&i!==null)return Qi(t,n,a),pa(t,o,e,i),r.fallbackAbortableTasks.forEach(function(e){return ba(e,t,n)}),r.fallbackAbortableTasks.clear(),Ea(t,r,e.row,i);r.status=4,i=Qi(t,n,a),r.status=4,r.errorDigest=i,ma(t,r),r.parentFlushed&&t.clientRenderedBoundaries.push(r)}r.pendingTasks--,i=r.row,i!==null&&--i.pendingTasks===0&&ea(t,i),r.fallbackAbortableTasks.forEach(function(e){return ba(e,t,n)}),r.fallbackAbortableTasks.clear()}e=e.row,e!==null&&--e.pendingTasks===0&&ea(t,e),t.allPendingTasks--,t.allPendingTasks===0&&Ca(t)}function xa(e,t){try{var n=e.renderState,r=n.onHeaders;if(r){var i=n.headers;if(i){n.headers=null;var a=i.preconnects;if(i.fontPreloads&&(a&&(a+=`, `),a+=i.fontPreloads),i.highImagePreloads&&(a&&(a+=`, `),a+=i.highImagePreloads),!t){var o=n.styles.values(),s=o.next();b:for(;0<i.remainingCapacity&&!s.done;s=o.next())for(var c=s.value.sheets.values(),l=c.next();0<i.remainingCapacity&&!l.done;l=c.next()){var u=l.value,d=u.props,f=d.href,p=u.props,m=vr(p.href,`style`,{crossOrigin:p.crossOrigin,integrity:p.integrity,nonce:p.nonce,type:p.type,fetchPriority:p.fetchPriority,referrerPolicy:p.referrerPolicy,media:p.media});if(0<=(i.remainingCapacity-=m.length+2))n.resets.style[f]=ye,a&&(a+=`, `),a+=m,n.resets.style[f]=typeof d.crossOrigin==`string`||typeof d.integrity==`string`?[d.crossOrigin,d.integrity]:ye;else break b}}r(a?{Link:a}:{})}}}catch(t){Qi(e,t,{})}}function Sa(e){e.trackedPostpones===null&&xa(e,!0),e.trackedPostpones===null&&Aa(e),e.onShellError=Gr,e=e.onShellReady,e()}function Ca(e){xa(e,e.trackedPostpones===null||e.completedRootSegment===null||e.completedRootSegment.status!==5),Aa(e),e=e.onAllReady,e()}function wa(e,t){if(t.chunks.length===0&&t.children.length===1&&t.children[0].boundary===null&&t.children[0].id===-1){var n=t.children[0];n.id=t.id,n.parentFlushed=!0,n.status!==1&&n.status!==3&&n.status!==4||wa(e,n)}else e.completedSegments.push(t)}function Ta(e,t,n){if(re!==null){n=n.chunks;for(var r=0,i=0;i<n.length;i++)r+=n[i].byteLength;t===null?e.byteSize+=r:t.byteSize+=r}}function Ea(e,t,n,r){if(n!==null&&(--n.pendingTasks===0?ea(e,n):n.together&&na(e,n)),e.allPendingTasks--,t===null){if(r!==null&&r.parentFlushed){if(e.completedRootSegment!==null)throw Error(a(389));e.completedRootSegment=r}e.pendingRootTasks--,e.pendingRootTasks===0&&Sa(e)}else if(t.pendingTasks--,t.status!==4)if(t.pendingTasks===0){if(t.status===0&&(t.status=1),r!==null&&r.parentFlushed&&(r.status===1||r.status===3)&&wa(t,r),t.parentFlushed&&e.completedBoundaries.push(t),t.status===1)n=t.row,n!==null&&Tr(n.hoistables,t.contentState),Ii(e,t)||(t.fallbackAbortableTasks.forEach(va,e),t.fallbackAbortableTasks.clear(),n!==null&&--n.pendingTasks===0&&ea(e,n)),e.pendingRootTasks===0&&e.trackedPostpones===null&&t.contentPreamble!==null&&Aa(e);else if(t.status===5&&(t=t.row,t!==null)){if(e.trackedPostpones!==null){n=e.trackedPostpones;var i=t.next;if(i!==null&&(r=i.boundaries,r!==null))for(i.boundaries=null,i=0;i<r.length;i++){var o=r[i];fa(e,n,o),Ea(e,o,null,null)}}--t.pendingTasks===0&&ea(e,t)}}else r===null||!r.parentFlushed||r.status!==1&&r.status!==3||(wa(t,r),t.completedSegments.length===1&&t.parentFlushed&&e.partialBoundaries.push(t)),t=t.row,t!==null&&t.together&&na(e,t);e.allPendingTasks===0&&Ca(e)}function Da(e){if(e.status!==14&&e.status!==13){var t=jr,n=he.H;he.H=Di;var r=he.A;he.A=ki;var i=Ui;Ui=e;var o=Oi;Oi=e.resumableState;try{var s=e.pingedTasks,c;for(c=0;c<s.length;c++){var l=s[c],u=e,d=l.blockedSegment;if(d===null){var f=u;if(l.replay.pendingTasks!==0){Lr(l.context);try{if(typeof l.replay.slots==`number`?ca(f,l,l.replay.slots,l.node,l.childIndex):ua(f,l),l.replay.pendingTasks===1&&0<l.replay.nodes.length)throw Error(a(488));l.replay.pendingTasks--,l.abortSet.delete(l),Ea(f,l.blockedBoundary,l.row,null)}catch(e){gi();var p=e===Kr?Yr():e;if(typeof p==`object`&&p&&typeof p.then==`function`){var m=l.ping;p.then(m,m),l.thenableState=e===Kr?hi():null}else{l.replay.pendingTasks--,l.abortSet.delete(l);var h=Zi(l.componentStack);u=void 0;var g=f,_=l.blockedBoundary,v=f.status===12?f.fatalError:p,y=l.replay.nodes,b=l.replay.slots;u=Qi(g,v,h),ya(g,_,y,b,v,u),f.pendingRootTasks--,f.pendingRootTasks===0&&Sa(f),f.allPendingTasks--,f.allPendingTasks===0&&Ca(f)}}}}else if(f=void 0,g=d,g.status===0){g.status=6,Lr(l.context);var x=g.children.length,S=g.chunks.length;try{ua(u,l),g.lastPushedText&&g.textEmbedded&&g.chunks.push(Be),l.abortSet.delete(l),g.status=1,Ta(u,l.blockedBoundary,g),Ea(u,l.blockedBoundary,l.row,g)}catch(e){gi(),g.children.length=x,g.chunks.length=S;var C=e===Kr?Yr():u.status===12?u.fatalError:e;if(u.status===12&&u.trackedPostpones!==null){var ee=u.trackedPostpones,w=Zi(l.componentStack);l.abortSet.delete(l),Qi(u,C,w),pa(u,ee,l,g),Ea(u,l.blockedBoundary,l.row,g)}else if(typeof C==`object`&&C&&typeof C.then==`function`){g.status=0,l.thenableState=e===Kr?hi():null;var T=l.ping;C.then(T,T)}else{var E=Zi(l.componentStack);l.abortSet.delete(l),g.status=4;var D=l.blockedBoundary,O=l.row;if(O!==null&&--O.pendingTasks===0&&ea(u,O),u.allPendingTasks--,f=Qi(u,C,E),D===null)$i(u,C);else if(D.pendingTasks--,D.status!==4){D.status=4,D.errorDigest=f,ma(u,D);var k=D.row;k!==null&&--k.pendingTasks===0&&ea(u,k),D.parentFlushed&&u.clientRenderedBoundaries.push(D),u.pendingRootTasks===0&&u.trackedPostpones===null&&D.contentPreamble!==null&&Aa(u)}u.allPendingTasks===0&&Ca(u)}}}}s.splice(0,c),e.destination!==null&&Ra(e,e.destination)}catch(t){Qi(e,t,{}),$i(e,t)}finally{Oi=o,he.H=n,he.A=r,n===Di&&Lr(t),Ui=i}}}function Oa(e,t,n){t.preambleChildren.length&&n.push(t.preambleChildren);for(var r=!1,i=0;i<t.children.length;i++)r=ka(e,t.children[i],n)||r;return r}function ka(e,t,n){var r=t.boundary;if(r===null)return Oa(e,t,n);var i=r.contentPreamble,o=r.fallbackPreamble;if(i===null||o===null)return!1;switch(r.status){case 1:if(At(e.renderState,i),e.byteSize+=r.byteSize,t=r.completedSegments[0],!t)throw Error(a(391));return Oa(e,t,n);case 5:if(e.trackedPostpones!==null)return!0;case 4:if(t.status===1)return At(e.renderState,o),Oa(e,t,n);default:return!0}}function Aa(e){if(e.completedRootSegment&&e.completedPreambleSegments===null){var t=[],n=e.byteSize,r=ka(e,e.completedRootSegment,t),i=e.renderState.preamble;!1===r||i.headChunks&&i.bodyChunks?e.completedPreambleSegments=t:e.byteSize=n}}function ja(e,t,n,r){switch(n.parentFlushed=!0,n.status){case 0:n.id=e.nextSegmentId++;case 5:return r=n.id,n.lastPushedText=!1,n.textEmbedded=!1,e=e.renderState,P(t,Nt),P(t,e.placeholderPrefix),e=I(r.toString(16)),P(t,e),F(t,Pt);case 1:n.status=2;var i=!0,o=n.chunks,s=0;n=n.children;for(var c=0;c<n.length;c++){for(i=n[c];s<i.index;s++)P(t,o[s]);i=Na(e,t,i,r)}for(;s<o.length-1;s++)P(t,o[s]);return s<o.length&&(i=F(t,o[s])),i;case 3:return!0;default:throw Error(a(390))}}var Ma=0;function Na(e,t,n,r){var i=n.boundary;if(i===null)return ja(e,t,n,r);if(i.parentFlushed=!0,i.status===4){var o=i.row;o!==null&&--o.pendingTasks===0&&ea(e,o),i=i.errorDigest,F(t,Y),P(t,Vt),i&&(P(t,Ut),P(t,I(V(i))),P(t,Ht)),F(t,Wt),ja(e,t,n,r)}else if(i.status!==1)i.status===0&&(i.rootSegmentID=e.nextSegmentId++),0<i.completedSegments.length&&e.partialBoundaries.push(i),Gt(t,e.renderState,i.rootSegmentID),r&&Tr(r,i.fallbackState),ja(e,t,n,r);else if(!La&&Ii(e,i)&&(Ma+i.byteSize>e.progressiveChunkSize||Er(i.contentState)))i.rootSegmentID=e.nextSegmentId++,e.completedBoundaries.push(i),Gt(t,e.renderState,i.rootSegmentID),ja(e,t,n,r);else{if(Ma+=i.byteSize,r&&Tr(r,i.contentState),n=i.row,n!==null&&Ii(e,i)&&--n.pendingTasks===0&&ea(e,n),F(t,Lt),n=i.completedSegments,n.length!==1)throw Error(a(391));Na(e,t,n[0],r)}return F(t,Bt)}function Pa(e,t,n,r){return fn(t,e.renderState,n.parentFormatContext,n.id),Na(e,t,n,r),pn(t,n.parentFormatContext)}function Fa(e,t,n){Ma=n.byteSize;for(var r=n.completedSegments,i=0;i<r.length;i++)Ia(e,t,n,r[i]);r.length=0,r=n.row,r!==null&&Ii(e,n)&&--r.pendingTasks===0&&ea(e,r),Wn(t,n.contentState,e.renderState),r=e.resumableState,e=e.renderState,i=n.rootSegmentID,n=n.contentState;var a=e.stylesToHoist;return e.stylesToHoist=!1,P(t,e.startInlineScript),P(t,J),a?(!(r.instructions&4)&&(r.instructions|=4,P(t,En)),!(r.instructions&2)&&(r.instructions|=2,P(t,vn)),r.instructions&8?P(t,xn):(r.instructions|=8,P(t,bn))):(!(r.instructions&2)&&(r.instructions|=2,P(t,vn)),P(t,yn)),r=I(i.toString(16)),P(t,e.boundaryPrefix),P(t,r),P(t,Sn),P(t,e.segmentPrefix),P(t,r),a?(P(t,Cn),sr(t,n)):P(t,wn),n=F(t,Tn),jt(t,e)&&n}function Ia(e,t,n,r){if(r.status===2)return!0;var i=n.contentState,o=r.id;if(o===-1){if((r.id=n.rootSegmentID)===-1)throw Error(a(392));return Pa(e,t,r,i)}return o===n.rootSegmentID?Pa(e,t,r,i):(Pa(e,t,r,i),n=e.resumableState,e=e.renderState,P(t,e.startInlineScript),P(t,J),n.instructions&1?P(t,hn):(n.instructions|=1,P(t,mn)),P(t,e.segmentPrefix),o=I(o.toString(16)),P(t,o),P(t,gn),P(t,e.placeholderPrefix),P(t,o),t=F(t,_n),t)}var La=!1;function Ra(e,t){M=new Uint8Array(2048),N=0;try{if(!(0<e.pendingRootTasks)){var n,r=e.completedRootSegment;if(r!==null){if(r.status===5)return;var i=e.completedPreambleSegments;if(i===null)return;Ma=e.byteSize;var a=e.resumableState,o=e.renderState,s=o.preamble,c=s.htmlChunks,l=s.headChunks,u;if(c){for(u=0;u<c.length;u++)P(t,c[u]);if(l)for(u=0;u<l.length;u++)P(t,l[u]);else P(t,Tt(`head`)),P(t,J)}else if(l)for(u=0;u<l.length;u++)P(t,l[u]);var d=o.charsetChunks;for(u=0;u<d.length;u++)P(t,d[u]);d.length=0,o.preconnects.forEach(Q,t),o.preconnects.clear();var f=o.viewportChunks;for(u=0;u<f.length;u++)P(t,f[u]);f.length=0,o.fontPreloads.forEach(Q,t),o.fontPreloads.clear(),o.highImagePreloads.forEach(Q,t),o.highImagePreloads.clear(),be=o,o.styles.forEach(Qn,t),be=null;var p=o.importMapChunks;for(u=0;u<p.length;u++)P(t,p[u]);p.length=0,o.bootstrapScripts.forEach(Q,t),o.scripts.forEach(Q,t),o.scripts.clear(),o.bulkPreloads.forEach(Q,t),o.bulkPreloads.clear(),c||l||(a.instructions|=32);var m=o.hoistableChunks;for(u=0;u<m.length;u++)P(t,m[u]);for(a=m.length=0;a<i.length;a++){var h=i[a];for(o=0;o<h.length;o++)Na(e,t,h[o],null)}var g=e.renderState.preamble,_=g.headChunks;(g.htmlChunks||_)&&P(t,kt(`head`));var v=g.bodyChunks;if(v)for(i=0;i<v.length;i++)P(t,v[i]);Na(e,t,r,null),e.completedRootSegment=null;var y=e.renderState;if(e.allPendingTasks!==0||e.clientRenderedBoundaries.length!==0||e.completedBoundaries.length!==0||e.trackedPostpones!==null&&(e.trackedPostpones.rootNodes.length!==0||e.trackedPostpones.rootSlots!==null)){var b=e.resumableState;if(!(b.instructions&64)){if(b.instructions|=64,P(t,y.startInlineScript),!(b.instructions&32)){b.instructions|=32;var x=`_`+b.idPrefix+`R_`;P(t,tr),P(t,I(V(x))),P(t,G)}P(t,J),P(t,Mt),F(t,H)}}jt(t,y)}var S=e.renderState;r=0;var C=S.viewportChunks;for(r=0;r<C.length;r++)P(t,C[r]);C.length=0,S.preconnects.forEach(Q,t),S.preconnects.clear(),S.fontPreloads.forEach(Q,t),S.fontPreloads.clear(),S.highImagePreloads.forEach(Q,t),S.highImagePreloads.clear(),S.styles.forEach(er,t),S.scripts.forEach(Q,t),S.scripts.clear(),S.bulkPreloads.forEach(Q,t),S.bulkPreloads.clear();var ee=S.hoistableChunks;for(r=0;r<ee.length;r++)P(t,ee[r]);ee.length=0;var w=e.clientRenderedBoundaries;for(n=0;n<w.length;n++){var T=w[n];S=t;var E=e.resumableState,D=e.renderState,O=T.rootSegmentID,k=T.errorDigest;P(S,D.startInlineScript),P(S,J),E.instructions&4?P(S,On):(E.instructions|=4,P(S,Dn)),P(S,D.boundaryPrefix),P(S,I(O.toString(16))),P(S,kn),k&&(P(S,An),P(S,I(Nn(k||``))));var A=F(S,jn);if(!A){e.destination=null,n++,w.splice(0,n);return}}w.splice(0,n);var j=e.completedBoundaries;for(n=0;n<j.length;n++)if(!Fa(e,t,j[n])){e.destination=null,n++,j.splice(0,n);return}j.splice(0,n),te(t),M=new Uint8Array(2048),N=0,La=!0;var ne=e.partialBoundaries;for(n=0;n<ne.length;n++){var L=ne[n];a:{w=e,T=t,Ma=L.byteSize;var re=L.completedSegments;for(A=0;A<re.length;A++)if(!Ia(w,T,L,re[A])){A++,re.splice(0,A);var ie=!1;break a}re.splice(0,A);var R=L.row;R!==null&&R.together&&L.pendingTasks===1&&(R.pendingTasks===1?ta(w,R,R.hoistables):R.pendingTasks--),ie=Wn(T,L.contentState,w.renderState)}if(!ie){e.destination=null,n++,ne.splice(0,n);return}}ne.splice(0,n),La=!1;var z=e.completedBoundaries;for(n=0;n<z.length;n++)if(!Fa(e,t,z[n])){e.destination=null,n++,z.splice(0,n);return}z.splice(0,n)}}finally{La=!1,e.allPendingTasks===0&&e.clientRenderedBoundaries.length===0&&e.completedBoundaries.length===0?(e.flushScheduled=!1,n=e.resumableState,n.hasBody&&P(t,kt(`body`)),n.hasHtml&&P(t,kt(`html`)),te(t),e.status=14,t.close(),e.destination=null):te(t)}}function za(e){e.flushScheduled=e.destination!==null,j(function(){return Da(e)}),O(function(){e.status===10&&(e.status=11),e.trackedPostpones===null&&xa(e,e.pendingRootTasks===0)})}function Ba(e){!1===e.flushScheduled&&e.pingedTasks.length===0&&e.destination!==null&&(e.flushScheduled=!0,O(function(){var t=e.destination;t?Ra(e,t):e.flushScheduled=!1}))}function Va(e,t){if(e.status===13)e.status=14,ie(t,e.fatalError);else if(e.status!==14&&e.destination===null){e.destination=t;try{Ra(e,t)}catch(t){Qi(e,t,{}),$i(e,t)}}}function Ha(e,t){(e.status===11||e.status===10)&&(e.status=12);try{var n=e.abortableTasks;if(0<n.size){var r=t===void 0?Error(a(432)):typeof t==`object`&&t&&typeof t.then==`function`?Error(a(530)):t;e.fatalError=r,n.forEach(function(t){return ba(t,e,r)}),n.clear()}e.destination!==null&&Ra(e,e.destination)}catch(t){Qi(e,t,{}),$i(e,t)}}function Ua(e,t,n){if(t===null)n.rootNodes.push(e);else{var r=n.workingMap,i=r.get(t);i===void 0&&(i=[t[1],t[2],[],null],r.set(t,i),Ua(i,t[0],n)),i[2].push(e)}}function Wa(e){var t=e.trackedPostpones;if(t===null||t.rootNodes.length===0&&t.rootSlots===null)return e.trackedPostpones=null;if(e.completedRootSegment===null||e.completedRootSegment.status!==5&&e.completedPreambleSegments!==null){var n=e.nextSegmentId,r=t.rootSlots,i=e.resumableState;i.bootstrapScriptContent=void 0,i.bootstrapScripts=void 0,i.bootstrapModules=void 0}else{n=0,r=-1,i=e.resumableState;var a=e.renderState;i.nextFormID=0,i.hasBody=!1,i.hasHtml=!1,i.unknownResources={font:a.resets.font},i.dnsResources=a.resets.dns,i.connectResources=a.resets.connect,i.imageResources=a.resets.image,i.styleResources=a.resets.style,i.scriptResources={},i.moduleUnknownResources={},i.moduleScriptResources={},i.instructions=0}return{nextSegmentId:n,rootFormatContext:e.rootFormatContext,progressiveChunkSize:e.progressiveChunkSize,resumableState:e.resumableState,replayNodes:t.rootNodes,replaySlots:r}}function Ga(){var e=r.version;if(e!==`19.2.7`)throw Error(a(527,e,`19.2.7`))}Ga(),Ga(),e.prerender=function(e,t){return new Promise(function(n,r){var i=t?t.onHeaders:void 0,a;i&&(a=function(e){i(new Headers(e))});var o=Pe(t?t.identifierPrefix:void 0,t?t.unstable_externalRuntimeSrc:void 0,t?t.bootstrapScriptContent:void 0,t?t.bootstrapScripts:void 0,t?t.bootstrapModules:void 0),s=Bi(e,o,Ne(o,void 0,t?t.unstable_externalRuntimeSrc:void 0,t?t.importMap:void 0,a,t?t.maxHeadersLength:void 0),Fe(t?t.namespaceURI:void 0),t?t.progressiveChunkSize:void 0,t?t.onError:void 0,function(){var e=new ReadableStream({type:`bytes`,pull:function(e){Va(s,e)},cancel:function(e){s.destination=null,Ha(s,e)}},{highWaterMark:0});e={postponed:Wa(s),prelude:e},n(e)},void 0,void 0,r,t?t.onPostpone:void 0);if(t&&t.signal){var c=t.signal;if(c.aborted)Ha(s,c.reason);else{var l=function(){Ha(s,c.reason),c.removeEventListener(`abort`,l)};c.addEventListener(`abort`,l)}}za(s)})},e.renderToReadableStream=function(e,t){return new Promise(function(n,r){var i,a,o=new Promise(function(e,t){a=e,i=t}),s=t?t.onHeaders:void 0,c;s&&(c=function(e){s(new Headers(e))});var l=Pe(t?t.identifierPrefix:void 0,t?t.unstable_externalRuntimeSrc:void 0,t?t.bootstrapScriptContent:void 0,t?t.bootstrapScripts:void 0,t?t.bootstrapModules:void 0),u=zi(e,l,Ne(l,t?t.nonce:void 0,t?t.unstable_externalRuntimeSrc:void 0,t?t.importMap:void 0,c,t?t.maxHeadersLength:void 0),Fe(t?t.namespaceURI:void 0),t?t.progressiveChunkSize:void 0,t?t.onError:void 0,a,function(){var e=new ReadableStream({type:`bytes`,pull:function(e){Va(u,e)},cancel:function(e){u.destination=null,Ha(u,e)}},{highWaterMark:0});e.allReady=o,n(e)},function(e){o.catch(function(){}),r(e)},i,t?t.onPostpone:void 0,t?t.formState:void 0);if(t&&t.signal){var d=t.signal;if(d.aborted)Ha(u,d.reason);else{var f=function(){Ha(u,d.reason),d.removeEventListener(`abort`,f)};d.addEventListener(`abort`,f)}}za(u)})},e.resume=function(e,t,n){return new Promise(function(r,i){var a,o,s=new Promise(function(e,t){o=e,a=t}),c=Vi(e,t,Ne(t.resumableState,n?n.nonce:void 0,void 0,void 0,void 0,void 0),n?n.onError:void 0,o,function(){var e=new ReadableStream({type:`bytes`,pull:function(e){Va(c,e)},cancel:function(e){c.destination=null,Ha(c,e)}},{highWaterMark:0});e.allReady=s,r(e)},function(e){s.catch(function(){}),i(e)},a,n?n.onPostpone:void 0);if(n&&n.signal){var l=n.signal;if(l.aborted)Ha(c,l.reason);else{var u=function(){Ha(c,l.reason),l.removeEventListener(`abort`,u)};l.addEventListener(`abort`,u)}}za(c)})},e.resumeAndPrerender=function(e,t,n){return new Promise(function(r,i){var a=Hi(e,t,Ne(t.resumableState,void 0,void 0,void 0,void 0,void 0),n?n.onError:void 0,function(){var e=new ReadableStream({type:`bytes`,pull:function(e){Va(a,e)},cancel:function(e){a.destination=null,Ha(a,e)}},{highWaterMark:0});e={postponed:Wa(a),prelude:e},r(e)},void 0,void 0,i,n?n.onPostpone:void 0);if(n&&n.signal){var o=n.signal;if(o.aborted)Ha(a,o.reason);else{var s=function(){Ha(a,o.reason),o.removeEventListener(`abort`,s)};o.addEventListener(`abort`,s)}}za(a)})},e.version=`19.2.7`})),y=e((e=>{var t=_(),n=v();e.version=t.version,e.renderToString=t.renderToString,e.renderToStaticMarkup=t.renderToStaticMarkup,e.renderToReadableStream=n.renderToReadableStream,e.resume=n.resume}))(),b=`/* Bandas de diagrama y cursor de lectura (ver diagramBands.tsx). Los colores
   son las señales técnicas: el acento de la familia nunca pinta un resultado. */
.fs-band { --fs-band-tone: var(--sc-color-text-primary); }
.fs-band--moment { --fs-band-tone: var(--sc-color-technical-moment); }
.fs-band--shear { --fs-band-tone: var(--sc-color-technical-shear); }
.fs-band--deformed { --fs-band-tone: var(--sc-color-technical-deformed); }
.fs-band--axial { --fs-band-tone: var(--sc-color-technical-axial); }
.fs-band__area { fill: var(--fs-band-tone); opacity: .1; }
.fs-band__line { fill: none; stroke: var(--fs-band-tone); stroke-width: 1.8; stroke-linejoin: round; }
.fs-band__capacity { fill: none; stroke: var(--sc-color-text-primary); stroke-width: 1.1; stroke-dasharray: 4 3; opacity: .75; }
.fs-band__axis { stroke: var(--sc-color-text-primary); stroke-width: .9; opacity: .7; }
.fs-band__grid { stroke: var(--sc-color-canvas-grid-strong, var(--sc-color-border-soft, var(--sc-color-border))); stroke-width: 1; stroke-dasharray: 2 4; }
.fs-band__dot { fill: var(--fs-band-tone); }
.fs-band text { font-family: var(--sc-font-mono); }
.fs-band__label { font-family: var(--sc-font-ui) !important; font-weight: 600; font-size: 11.5px; fill: var(--fs-band-tone) !important; }
.fs-band__unit { font-size: 10px; fill: var(--sc-color-text-secondary) !important; }
.fs-band__value { font-weight: 600; font-size: 11px; fill: var(--sc-color-text-primary); }

.fs-probe-frame { display: grid; gap: 8px; }
.fs-probe-target { cursor: crosshair; touch-action: pan-y; border-radius: var(--sc-radius-data); }
.fs-probe-target:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 4px; }
.fs-probe__line { stroke: var(--sc-color-text-primary); stroke-width: 1; stroke-dasharray: 3 3; opacity: .55; }
.fs-probe__dot { stroke: var(--sc-color-surface-1); stroke-width: 1.5; }
.fs-probe__dot--moment { fill: var(--sc-color-technical-moment); }
.fs-probe__dot--shear { fill: var(--sc-color-technical-shear); }
.fs-probe__dot--deformed { fill: var(--sc-color-technical-deformed); }
.fs-probe__dot--axial { fill: var(--sc-color-technical-axial); }
.fs-probe-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  min-height: 32px;
  margin: 0;
  padding: 7px 10px;
  border: 1px solid var(--sc-color-border-soft, var(--sc-color-border));
  border-radius: var(--sc-radius-data);
  background: var(--sc-color-surface-1);
  color: var(--sc-color-text-primary);
  font: 500 11.5px/1.45 var(--sc-font-mono);
}
.fs-probe-readout b { font-family: var(--sc-font-ui); font-weight: 600; }
.fs-probe-readout [data-tone='moment'] b { color: var(--fs-signal-moment-ink, var(--sc-color-technical-moment)); }
.fs-probe-readout [data-tone='shear'] b { color: var(--fs-signal-shear-ink, var(--sc-color-technical-shear)); }
.fs-probe-readout [data-tone='deformed'] b { color: var(--fs-signal-deformed-ink, var(--sc-color-technical-deformed)); }
.fs-probe-readout [data-tone='axial'] b { color: var(--fs-signal-axial-ink, var(--sc-color-technical-axial)); }
.fs-probe-readout__hint { color: var(--sc-color-text-secondary); font-family: var(--sc-font-ui); }
`,x=`/*
 * Diseño de elementos. Mismo lenguaje que el Modelo 2D: un lienzo hundido con
 * cuadrícula en el centro, controles flotantes con la misma luz y paneles
 * planos a los lados. Los colores de dominio sólo trazan resultados.
 */
.design-workbench {
  --dw-ink: var(--sc-color-text-primary);
  --dw-muted: var(--sc-color-text-secondary);
  --dw-subtle: var(--sc-color-text-tertiary, var(--sc-color-text-secondary));
  --dw-line: var(--sc-color-border-soft, var(--sc-color-border));
  --dw-pass: var(--sc-color-state-success);
  --dw-fail: var(--sc-color-state-error);
  --dw-warn: var(--sc-color-state-warning);
  --dw-moment: var(--sc-color-technical-moment);
  --dw-shear: var(--sc-color-technical-shear);
  --dw-axial: var(--sc-color-technical-axial);
  --dw-deformed: var(--sc-color-technical-deformed);
  --dw-steel: var(--sc-color-text-primary);
  --dw-bastion: var(--sc-color-action-primary);
  position: absolute;
  inset: 0;
  display: flex;
  min-height: 0;
  overflow: hidden;
  color: var(--dw-ink);
  font-family: var(--sc-font-ui);
  font-size: var(--sc-font-size-body);
}

.dw-input-note { margin: 4px 0 12px; color: var(--dw-muted); font-size: 11px; line-height: 1.6; }
.dw-action-feedback { position: absolute; z-index: 30; top: 10px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; width: max-content; max-width: calc(100% - 24px); margin: 0; padding: 10px 12px; border: 1px solid var(--dw-line); border-left: 3px solid var(--fs-signal-attention); border-radius: var(--sc-radius-card); background: var(--sc-color-surface-1); box-shadow: var(--sc-shadow-md); font-size: 12px; line-height: 1.5; }
.dw-action-feedback button { flex: none; min-width: 44px; min-height: 44px; border: 0; border-radius: var(--sc-radius-control); background: var(--sc-color-surface-2); color: var(--dw-ink); font-size: 20px; cursor: pointer; }
.dw-review-inputs { position: absolute; z-index: 3; bottom: 130px; left: var(--dw-left); right: var(--dw-right); display: grid; justify-items: center; gap: 8px; padding: 10px; text-align: center; }
.dw-review-inputs button { min-height: 44px; padding: 10px 18px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-control); background: var(--sc-color-surface-1); color: var(--dw-ink); box-shadow: var(--sc-shadow-xs); cursor: pointer; }
.dw-review-inputs span { color: var(--dw-muted); font-size: 12px; line-height: 1.5; }
.dw-eyebrow {
  margin: 0;
  color: var(--dw-muted);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .07em;
  text-transform: uppercase;
}

/* ─── Mesa: el lienzo ocupa todo; datos y resultados flotan encima ─── */
.dw-layout {
  --dw-panel-inputs: 304px;
  --dw-panel-results: 320px;
  --dw-edge: 12px;
  --dw-left: var(--dw-edge);
  --dw-right: var(--dw-edge);
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  padding: 8px;
}
.dw-layout[data-inputs='open'] { --dw-left: calc(var(--dw-panel-inputs) + 2 * var(--dw-edge)); }
.dw-layout[data-results='open'] { --dw-right: calc(var(--dw-panel-results) + 2 * var(--dw-edge)); }

/* ─── Lienzo: igual al del Modelo 2D ─── */
.dw-stage {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-radius: var(--sc-radius-card);
  background-color: var(--sc-color-bg-canvas);
  background-image:
    linear-gradient(var(--sc-color-canvas-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--sc-color-canvas-grid) 1px, transparent 1px);
  background-size: 48px 48px;
  box-shadow: var(--sc-shadow-inset);
  overflow: hidden;
}
.dw-stage__scroll {
  position: absolute;
  inset: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 64px calc(var(--dw-right) + 16px) 160px calc(var(--dw-left) + 16px);
  scrollbar-width: thin;
  transition: padding var(--sc-motion-bridge) var(--sc-ease-standard);
}
.dw-stage__content {
  --z: var(--dw-zoom, 1);
  width: calc(100% * var(--z));
  margin-inline: auto;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: safe center;
  gap: calc(12px * var(--z)) calc(32px * var(--z));
  padding-bottom: 40px;
}

/* Chips sobre el lienzo: veredicto a la izquierda, norma a la derecha. */
.dw-hud { position: absolute; top: 12px; z-index: 2; display: flex; gap: 6px; min-width: 0; transition: left var(--sc-motion-bridge) var(--sc-ease-standard), right var(--sc-motion-bridge) var(--sc-ease-standard); }
.dw-hud--start { left: var(--dw-left); max-width: calc(100% - var(--dw-left) - var(--dw-right) - 150px); }
.dw-hud--end { right: var(--dw-right); }

.dw-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--sc-radius-card);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-raised);
  color: var(--dw-ink);
  font: 600 12px/1 var(--sc-font-ui);
  white-space: nowrap;
}
.dw-badge i { flex: none; width: 8px; height: 8px; border-radius: var(--sc-radius-pill); background: var(--status); }
.dw-badge[data-status] { --status: var(--dw-pass); color: var(--status); }
.dw-badge[data-status='fail'], .dw-badge[data-status='error'] { --status: var(--dw-fail); }
.dw-badge[data-status='warning'] { --status: var(--dw-warn); }
.dw-badge--button {
  cursor: pointer;
  transition:
    box-shadow var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-badge--button:disabled { cursor: default; }
.dw-badge--button:hover:not(:disabled) {
  box-shadow: var(--sc-shadow-lifted);
  transform: translateY(-1px);
}
.dw-badge--button:active:not(:disabled) {
  transform: var(--sc-press-transform);
  box-shadow: var(--sc-shadow-inset);
}
.dw-badge--caption { overflow: hidden; text-overflow: ellipsis; color: var(--dw-muted); font-weight: 500; }

.dw-code-chip { position: relative; display: inline-flex; align-items: center; }
.dw-code-chip select {
  appearance: none;
  min-height: 34px;
  padding: 0 30px 0 12px;
  border: 0;
  border-radius: var(--sc-radius-card);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-raised);
  color: var(--dw-ink);
  font: 600 12px/1 var(--sc-font-ui);
  cursor: pointer;
}
.dw-code-chip svg { position: absolute; right: 10px; color: var(--dw-muted); pointer-events: none; }

.dw-badge--button:focus-visible, .dw-code-chip select:focus-visible, .dw-zoom button:focus-visible,
.dw-icon-button:focus-visible, .dw-add:focus-visible, .dw-more__toggle:focus-visible {
  outline: var(--sc-focus-ring-width) solid var(--sc-color-focus);
  outline-offset: 2px;
}

/* Zoom del lienzo: la misma pieza que en el Modelo 2D. */
.dw-zoom {
  position: absolute;
  right: var(--dw-right);
  bottom: 16px;
  z-index: 2;
  display: flex;
  padding: 3px;
  border-radius: var(--sc-radius-card);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-raised);
  transition: right var(--sc-motion-bridge) var(--sc-ease-standard);
}
.dw-zoom button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 32px;
  border: 0;
  border-radius: var(--sc-radius-control);
  background: transparent;
  color: var(--dw-muted);
  cursor: pointer;
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    color var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-zoom button:hover:not(:disabled) {
  color: var(--dw-ink);
  background: var(--sc-color-fill-quaternary);
  transform: translateY(-1px);
}
.dw-zoom button:active:not(:disabled) {
  transform: var(--sc-press-transform);
}
.dw-zoom button:disabled { opacity: .35; cursor: default; }

/* Barra flotante inferior: elementos y vistas, como la barra de herramientas 2D. */
.dw-dock {
  position: absolute;
  left: calc(var(--dw-left) + 8px);
  right: calc(var(--dw-right) + 8px);
  bottom: 22px;
  z-index: 5;
  width: max-content;
  max-width: calc(100% - var(--dw-left) - var(--dw-right) - 16px);
  margin-inline: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 6px;
  border-radius: var(--sc-radius-panel);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-lifted);
  overflow-x: auto;
  scrollbar-width: none;
  transition: left var(--sc-motion-bridge) var(--sc-ease-standard), right var(--sc-motion-bridge) var(--sc-ease-standard);
}
.dw-dock__group { display: flex; gap: 4px; }
.dw-dock__divider { flex: none; width: 1px; height: 24px; margin: 0 4px; background: var(--dw-line); }
.dw-dock .sc-tool-button {
  flex: none;
  width: auto;
  min-height: 38px;
  padding: 0 12px 0 8px;
  grid-template-columns: auto auto;
  border-radius: var(--sc-radius-control);
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    box-shadow var(--sc-motion-control) var(--sc-ease-standard),
    color var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-dock .sc-tool-button:hover:not(:disabled) {
  transform: translateY(-1px);
}
.dw-dock .sc-tool-button:active:not(:disabled) {
  transform: var(--sc-press-transform);
  box-shadow: var(--sc-shadow-inset);
}
.dw-dock .sc-tool-button:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }
.dw-element-icon { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linejoin: round; stroke-linecap: round; }

/* Vistas: en escritorio, dos interruptores de panel; en móvil, pestañas. */
.dw-views { display: flex; gap: 4px; }
.dw-view {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 38px;
  min-height: 38px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--sc-radius-control);
  background: transparent;
  color: var(--dw-muted);
  font: 600 12px/1 var(--sc-font-ui);
  cursor: pointer;
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    box-shadow var(--sc-motion-control) var(--sc-ease-standard),
    color var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-view:hover:not(:disabled) {
  color: var(--dw-ink);
  background: var(--sc-color-surface-2);
  transform: translateY(-1px);
}
.dw-view:active:not(:disabled) {
  transform: var(--sc-press-transform);
  box-shadow: var(--sc-shadow-inset);
}
.dw-view[aria-pressed='true'] { color: var(--sc-color-action-primary); background: var(--sc-color-surface-2); }
.dw-view:disabled { opacity: .4; cursor: default; }
.dw-view:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }
.dw-view > span, .dw-view > em, .dw-view--stage { display: none; }
.dw-view > em { --status: var(--dw-pass); align-items: center; gap: 4px; color: var(--status); font: 600 11px/1 var(--sc-font-mono); font-style: normal; }
.dw-view > em i { width: 7px; height: 7px; border-radius: var(--sc-radius-pill); background: var(--status); }
.dw-view[data-status='fail'] > em { --status: var(--dw-fail); }
.dw-view[data-status='warning'] > em { --status: var(--dw-warn); }

/* Láminas: dibujo directo sobre el lienzo, sin marco. Todo escala con el zoom. */
.dw-plate { flex: 1 1 calc(300px * var(--z)); max-width: calc(440px * var(--z)); min-width: 0; margin: 0; }
.dw-plate--wide { flex: 1 1 100%; max-width: calc(980px * var(--z)); }
.dw-plate figcaption { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 0 0 8px; }
.dw-plate figcaption small { color: var(--dw-subtle); font-size: 11px; }

/* ─── Paneles flotantes ─── */
.dw-panel {
  position: absolute;
  top: calc(8px + var(--dw-edge));
  bottom: calc(8px + var(--dw-edge));
  z-index: 4;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: var(--sc-radius-panel);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-lifted);
  transition:
    transform var(--sc-motion-bridge) var(--sc-ease-standard),
    opacity var(--sc-motion-bridge) var(--sc-ease-standard),
    visibility 0s linear 0s;
}
.dw-inputs { left: calc(8px + var(--dw-edge)); width: var(--dw-panel-inputs); }
.dw-results { right: calc(8px + var(--dw-edge)); width: var(--dw-panel-results); }
.dw-panel[data-open='false'] {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transition:
    transform var(--sc-motion-bridge) var(--sc-ease-standard),
    opacity var(--sc-motion-bridge) var(--sc-ease-standard),
    visibility 0s linear var(--sc-motion-bridge);
}
.dw-inputs[data-open='false'] { transform: translateX(-16px); }
.dw-results[data-open='false'] { transform: translateX(16px); }
.dw-panel__head { flex: none; display: flex; align-items: center; gap: 2px; padding: 12px 10px 8px 16px; }
.dw-panel__head h2 { flex: 1; min-width: 0; margin: 0; font: 600 var(--sc-font-size-display-md)/1.15 var(--sc-font-display); }
.dw-panel__body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; padding: 0 14px 20px; }
.dw-results .dw-panel__body { display: flex; flex-direction: column; }

/* ─── Formulario ─── */
.dw-hook { stroke: var(--dw-steel); stroke-width: 2.6; stroke-linecap: round; fill: none; }
.dw-hook.is-fail { stroke: var(--dw-fail); }
.dw-icon-button {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--sc-radius-control);
  background: transparent;
  color: var(--dw-muted);
  cursor: pointer;
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    color var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-icon-button:hover:not(:disabled) {
  color: var(--dw-ink);
  background: var(--sc-color-fill-quaternary);
  transform: translateY(-1px);
}
.dw-icon-button:active:not(:disabled) {
  transform: var(--sc-press-transform);
}
.dw-icon-button:disabled { opacity: .35; cursor: default; }

.dw-group { padding: 14px 2px 12px; border-top: 1px solid var(--dw-line); min-width: 0; }
.dw-panel__body > .dw-group:first-child { border-top: 0; padding-top: 4px; }
.dw-group > header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.dw-group__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.dw-group__grid[data-columns='1'] { grid-template-columns: minmax(0, 1fr); }
.dw-group__grid[data-columns='3'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.dw-span-all { grid-column: 1 / -1; }
.dw-group .sc-segmented { width: 100%; }
.dw-end { display: grid; grid-template-columns: 58px minmax(0, 1fr); align-items: center; gap: 8px; }
.dw-end > span { color: var(--dw-muted); font-size: 11.5px; }
.dw-group .sc-segmented button { flex: 1; padding-inline: 4px; }
.dw-group .sc-unit-field__control input { min-width: 0; }

.dw-more { padding-top: 6px; }
.dw-more__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 0;
  border: 0;
  background: none;
  color: var(--dw-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dw-more__toggle:hover { color: var(--dw-ink); }
.dw-more__toggle svg { transition: transform var(--sc-motion-quick) var(--sc-ease-standard); }
.dw-more__toggle[aria-expanded='true'] svg { transform: rotate(180deg); }
.dw-more__toggle[aria-expanded='true'] { margin-bottom: 8px; }
.dw-results .dw-more { border-top: 1px solid var(--dw-line); }
.dw-more__body > * + * { margin-top: 14px; }

/* Tabla de claros */
.dw-spans { --cols: 3; display: grid; gap: 6px; }
.dw-spans__row--sub { margin-top: -2px; }
.dw-spans__row--sub input { height: 28px; background: var(--sc-color-surface-1); }
.dw-spans__head--sub { margin-top: 2px; }
.dw-spans__row { display: grid; grid-template-columns: 18px repeat(var(--cols), minmax(0, 1fr)) 30px; gap: 5px; align-items: center; }
.dw-spans__head span { color: var(--dw-muted); font-size: 11px; font-weight: 600; text-align: center; line-height: 1.1; }
.dw-spans__head small { display: block; color: var(--dw-subtle); font-weight: 400; font-size: 9.5px; }
.dw-spans__index { color: var(--dw-subtle); font: 500 11px var(--sc-font-mono); text-align: center; }
.dw-spans input {
  width: 100%;
  min-width: 0;
  height: var(--sc-control-height-sm, 32px);
  padding: 0 7px;
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-data);
  background: var(--sc-color-surface-input);
  box-shadow: var(--sc-shadow-inset);
  color: var(--dw-ink);
  font: 500 12px var(--sc-font-mono);
  text-align: right;
}
.dw-spans input:focus { outline: none; border-color: var(--sc-color-action-primary); }
.dw-spans input[aria-invalid='true'] { border-color: var(--sc-color-state-error); }
.dw-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  margin-top: 2px;
  border: 1px dashed var(--sc-color-border);
  border-radius: var(--sc-radius-data);
  background: transparent;
  color: var(--dw-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dw-add:hover { color: var(--dw-ink); border-color: var(--dw-muted); }

/* ─── Dibujos ─── */
.dw-drawing { display: block; width: 100%; height: auto; overflow: visible; font-family: var(--sc-font-mono); font-size: 11px; }
.dw-drawing--section { max-width: calc(250px * var(--z, 1)); margin-inline: auto; }
.dw-drawing--plan { max-width: calc(340px * var(--z, 1)); margin-inline: auto; }
.dw-chart { max-width: calc(600px * var(--z, 1)); margin-inline: auto; }
.dw-drawing text { fill: var(--dw-ink); }
.dw-drawing .dw-muted { fill: var(--dw-muted); }

.dw-beam, .dw-concrete { fill: var(--sc-color-surface-1); stroke: var(--dw-ink); stroke-width: 1.3; }
.dw-column { fill: var(--sc-color-surface-3, var(--sc-color-surface-2)); stroke: var(--dw-ink); stroke-width: 1.3; }
.dw-pedestal { fill: var(--sc-color-surface-2); stroke: var(--dw-ink); stroke-width: 1.3; }
.dw-rebar { stroke: var(--dw-steel); stroke-width: 2.6; stroke-linecap: round; }
.dw-stirrup-tick { stroke: var(--dw-muted); stroke-width: .9; }
.dw-zone { fill: var(--dw-shear); opacity: .8; }
.dw-stirrup { fill: none; stroke: var(--dw-muted); }
.dw-bar { fill: var(--dw-steel); }
.dw-bar--extra { fill: var(--dw-bastion); }
.dw-bastion line:first-child, .dw-bastion path { stroke: var(--dw-bastion); stroke-width: 2.6; stroke-linecap: round; fill: none; }
.dw-bastion text { fill: var(--dw-bastion) !important; font-family: var(--sc-font-ui); font-weight: 600; font-size: 11px; }
.dw-bastion__leader { stroke: var(--dw-bastion); stroke-width: .8 !important; stroke-dasharray: 2 2; opacity: .7; }
.dw-rebar-label { font-family: var(--sc-font-ui); font-weight: 600; font-size: 11px; }
.dw-stirrup-label { fill: var(--dw-muted) !important; font-size: 10.5px; }
.dw-rebar-grid line { stroke: var(--dw-muted); stroke-width: .8; opacity: .6; }
.dw-critical { fill: none; stroke: var(--dw-shear); stroke-width: 1.5; stroke-dasharray: 6 4; }
.dw-critical--oneway { stroke-dasharray: 2 3; }
.dw-property-line { stroke: var(--dw-ink); stroke-width: 2.5; stroke-dasharray: 10 4 2 4; }

.dw-load line { stroke: var(--sc-color-load-distributed, var(--dw-ink)); stroke-width: 1.2; }
.dw-load__head { fill: var(--sc-color-load-distributed, var(--dw-ink)); }
.dw-load text { font-size: 11px; fill: var(--sc-color-load-distributed, var(--dw-ink)) !important; }
.dw-load--point line { stroke-width: 2; }
.dw-support path { fill: var(--sc-color-surface-1); stroke: var(--dw-ink); stroke-width: 1.3; }
.dw-support line { stroke: var(--dw-ink); stroke-width: 1.8; }
.dw-support .dw-support__hatch { stroke-width: 1; }
.dw-dimension line { stroke: var(--sc-color-technical-dimension, var(--dw-muted)); stroke-width: 1; }
.dw-dimension text { fill: var(--dw-muted); font-size: 10.5px; }
.dw-callout { font-family: var(--sc-font-ui); font-weight: 600; font-size: 11.5px; }
.dw-axis line { stroke: var(--dw-muted); stroke-width: .8; stroke-dasharray: 5 3 1 3; }
.dw-axis text { fill: var(--dw-muted); font-size: 10px; font-weight: 600; }
.dw-soil line { stroke: var(--dw-axial); stroke-width: 1.2; }
.dw-soil__head { fill: var(--dw-axial); }
.dw-soil text { fill: var(--dw-muted); font-size: 10.5px; }

/* Las bandas de diagrama (\`fs-band\`) y el cursor de lectura (\`fs-probe\`) son
   comunes: \`src/design-system/components/diagramBands.css\`. */

.dw-chart__grid line { stroke: var(--sc-color-canvas-grid-strong, var(--dw-line)); stroke-width: .8; }
.dw-chart__grid text { fill: var(--dw-muted); font-size: 10px; }
.dw-chart__zero { stroke: var(--dw-ink); stroke-width: 1; opacity: .7; }
.dw-chart__title { font-family: var(--sc-font-ui); font-size: 11px; fill: var(--dw-muted) !important; }
.dw-curve { fill: none; stroke-linejoin: round; }
.dw-curve--x { stroke: var(--dw-axial); stroke-width: 2.2; }
.dw-curve--y { stroke: var(--dw-deformed); stroke-width: 2.2; stroke-dasharray: 8 4; }
.dw-curve--nominal { stroke: var(--dw-muted); stroke-width: 1.1; stroke-dasharray: 2 3; }
.dw-chart__cap line { stroke: var(--dw-axial); stroke-width: 1; stroke-dasharray: 4 3; }
.dw-chart__cap text { fill: var(--dw-axial) !important; font-size: 10px; }
.dw-chart__balanced { fill: var(--sc-color-bg-canvas); stroke: var(--dw-axial); stroke-width: 1.5; }
.dw-demand line { stroke: var(--dw-moment); stroke-width: 1; stroke-dasharray: 3 3; }
.dw-demand circle { fill: var(--dw-moment); stroke: var(--sc-color-bg-canvas); stroke-width: 2; }
.dw-demand text { font-family: var(--sc-font-ui); font-weight: 600; fill: var(--dw-moment) !important; }

.dw-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; margin: 6px 0 0; padding: 0; list-style: none; color: var(--dw-muted); font-size: 11px; }
.dw-legend li { display: flex; align-items: center; gap: 6px; }
.dw-legend li::before { content: ''; width: 18px; height: 0; border-top: 2.2px solid var(--dw-axial); }
.dw-legend li[data-kind='y']::before { border-top-color: var(--dw-deformed); border-top-style: dashed; }
.dw-legend li[data-kind='nominal']::before { border-top: 1.4px dotted var(--dw-muted); }
.dw-legend li[data-kind='demand']::before { width: 9px; height: 9px; border: 0; border-radius: var(--sc-radius-pill); background: var(--dw-moment); }

/* ─── Resultados: planos, separados por filetes ─── */
.dw-verdict { --status: var(--dw-pass); padding: 4px 2px 16px; }
.dw-verdict[data-status='fail'] { --status: var(--dw-fail); }
.dw-verdict[data-status='warning'] { --status: var(--dw-warn); }
.dw-verdict__head { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.dw-verdict__head > svg { flex: none; color: var(--status); }
.dw-verdict__head strong { font: 600 var(--sc-font-size-display-md)/1.15 var(--sc-font-display); }
.dw-verdict__percent { margin-left: auto; font: 600 24px/1 var(--sc-font-mono); color: var(--status); }
.dw-verdict__percent small { font-size: 12px; margin-left: 1px; }
.dw-verdict__scope { display: flex; align-items: flex-start; gap: 6px; margin: 10px 0 0; color: var(--dw-muted); font-size: 11.5px; line-height: 1.4; }
.dw-verdict__scope > svg { flex: none; margin-top: 2px; }

.dw-meter { position: relative; height: 5px; margin-top: 12px; border-radius: var(--sc-radius-pill); background: var(--sc-color-surface-inset); overflow: hidden; }
.dw-meter i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--status, var(--dw-pass)); transition: width var(--sc-motion-bridge) var(--sc-ease-standard); }
.dw-meter--thin { height: 3px; margin-top: 4px; }

.dw-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; margin: 14px 0 0; }
.dw-summary div { min-width: 0; padding-left: 8px; border-left: 2px solid var(--dw-line); }
.dw-summary div[data-tone='moment'] { border-left-color: var(--dw-moment); }
.dw-summary div[data-tone='shear'] { border-left-color: var(--dw-shear); }
.dw-summary div[data-tone='axial'] { border-left-color: var(--dw-axial); }
.dw-summary dt { color: var(--dw-muted); font-size: 10.5px; }
.dw-summary dd { margin: 2px 0 0; font: 500 12px/1.3 var(--sc-font-mono); overflow-wrap: anywhere; }

.dw-section { padding: 14px 2px; border-top: 1px solid var(--dw-line); }
.dw-section > .dw-eyebrow { margin-bottom: 10px; }

.dw-rebar-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.dw-rebar-list li { display: flex; gap: 10px; align-items: flex-start; }
.dw-rebar-list li > div { display: grid; gap: 2px; min-width: 0; }
.dw-rebar-list strong { font: 600 13px/1.3 var(--sc-font-display); }
.dw-rebar-list small { color: var(--dw-muted); font: 11px/1.35 var(--sc-font-mono); }
.dw-swatch { flex: none; width: 10px; height: 10px; margin-top: 4px; border-radius: var(--sc-radius-pill); background: var(--dw-steel); }
.dw-swatch--stirrup { border-radius: 0; background: transparent; border: 2px solid var(--dw-muted); }
.dw-swatch--extra { background: var(--dw-bastion); }

.dw-table { width: 100%; border-collapse: collapse; font: 500 11.5px var(--sc-font-mono); }
.dw-table th, .dw-table td { padding: 5px 4px; border-bottom: 1px solid var(--dw-line); text-align: right; }
.dw-table thead th { color: var(--dw-muted); font: 600 10.5px var(--sc-font-ui); }
.dw-table th:first-child { text-align: left; }
.dw-table tbody th { color: var(--dw-muted); font-weight: 500; }
.dw-table td[data-status='fail'] { color: var(--dw-fail); }
.dw-section .dw-table + .dw-rebar-list { margin-top: 12px; }
.dw-footnote { margin: 6px 0 0; color: var(--dw-subtle); font-size: 10.5px; }

.dw-checks { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.dw-checks li { --status: var(--dw-pass); min-width: 0; }
.dw-checks li[data-status='fail'] { --status: var(--dw-fail); }
.dw-checks li[data-status='warning'] { --status: var(--dw-warn); }
.dw-checks li[data-status='info'] { --status: var(--dw-muted); }
.dw-checks li[data-status='out-of-scope'] { --status: var(--dw-subtle); }
.dw-checks__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--dw-ink);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
.dw-checks__row > svg { color: var(--status); }
.dw-checks__row b { font: 600 11.5px var(--sc-font-mono); color: var(--status); white-space: nowrap; }
.dw-checks__row:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }
.dw-checks .dw-meter--thin { margin: 0 0 6px 22px; }
.dw-checks__detail { display: grid; gap: 3px; margin: 0 0 8px 22px; }
.dw-checks small { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 8px; color: var(--dw-muted); font: 10.5px/1.35 var(--sc-font-mono); }
.dw-checks small em { margin-left: auto; font-style: normal; text-align: right; color: var(--dw-subtle); }
.dw-reference[data-basis='complementary'] { font-style: italic; }
.dw-reference[data-basis='complementary']::before { content: '◇ '; }
.dw-checks .dw-checks__note { display: block; font-family: var(--sc-font-ui); }
.dw-checks__trace { display: grid; gap: 2px; margin: 0; font-size: 11px; }
.dw-checks__trace > div { display: flex; gap: 8px; }
.dw-checks__trace dt { flex: none; width: 58px; color: var(--dw-subtle); }
.dw-checks__trace dd { margin: 0; min-width: 0; color: var(--dw-muted); overflow-wrap: anywhere; }

.dw-review { display: grid; gap: 10px; }
.dw-review__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.dw-review__order {
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid var(--dw-line);
  border-radius: var(--sc-radius-control, 6px);
  background: none;
  color: var(--dw-muted);
  font: 500 11px var(--sc-font-ui);
  cursor: pointer;
}
.dw-review__order[aria-pressed='true'] { color: var(--dw-ink); border-color: var(--dw-muted); }
.dw-review__order:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }
.dw-review__empty { margin: 4px 0; color: var(--dw-muted); font-size: 12px; }

.dw-values { display: grid; gap: 0; margin: 0; font-size: 11.5px; }
.dw-values > div { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px solid var(--dw-line); }
.dw-values > div:last-child { border-bottom: 0; }
.dw-values dt { color: var(--dw-muted); }
.dw-values dt b { color: var(--dw-ink); font: 500 11px var(--sc-font-mono); margin-right: 6px; }
.dw-values dd { margin: 0; text-align: right; font: 500 11.5px var(--sc-font-mono); white-space: nowrap; }

.dw-errors {
  display: flex;
  gap: 10px;
  align-self: center;
  max-width: 440px;
  margin-top: 40px;
  padding: 16px;
  border-radius: var(--sc-radius-card);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-raised);
  color: var(--dw-fail);
}
.dw-errors strong { color: var(--dw-ink); }
.dw-errors ul { margin: 6px 0 0; padding-left: 18px; color: var(--dw-ink); line-height: 1.45; }

/* Sin espacio para dos paneles: se abre uno a la vez (lo decide \`DesignWorkbench\`). */
@media (max-width: 1240px) {
  .dw-layout { --dw-panel-inputs: 292px; --dw-panel-results: 300px; }
  /* La barra inferior ocupa casi todo el ancho libre: el zoom sube sobre ella. */
  .dw-zoom { bottom: 76px; }
}

/*
 * Móvil: tres vistas a pantalla completa. Arriba el elemento, en medio la vista
 * elegida (dibujo, datos o resultados) y abajo pestañas fijas con el veredicto.
 * Nada se encima y el dibujo se ajusta al ancho; se amplía con dos dedos.
 */
@media (max-width: 760px) {
  .dw-layout, .dw-layout[data-inputs='open'], .dw-layout[data-results='open'] {
    --dw-left: 10px;
    --dw-right: 10px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: 0;
  }
  .dw-dock { display: contents; }
  .dw-dock__divider { display: none; }

  .dw-dock__group {
    grid-row: 1;
    grid-column: 1;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
    margin: 6px 8px;
    padding: 4px;
    border-radius: var(--sc-radius-card);
    background: var(--sc-color-surface-inset, var(--sc-color-surface-2));
    box-shadow: var(--sc-shadow-inset);
  }
  .dw-dock .sc-tool-button {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    min-height: 52px;
    padding: 6px 2px;
    font-size: 11px;
  }
  .dw-dock .sc-tool-button__copy strong { font-size: 11px; }
  /* Cinco elementos en un renglón: sin desbordar en 360 px. */
  .dw-dock__group .sc-tool-button { min-width: 0; overflow: hidden; }
  .dw-dock__group .sc-tool-button__copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .dw-stage, .dw-panel { grid-row: 2; grid-column: 1; }
  .dw-stage { margin: 0 8px; }
  .dw-layout[data-inputs='open'] .dw-stage, .dw-layout[data-results='open'] .dw-stage { visibility: hidden; }
  .dw-stage__scroll { padding: 54px 10px 64px; }
  .dw-hud { top: 10px; }
  .dw-hud--start { max-width: calc(100% - 150px); }
  .dw-badge--caption { display: none; }
  .dw-plate, .dw-plate--wide { flex-basis: 100%; }

  /* Zoom con dos dedos; sólo queda el botón para volver al tamaño normal. */
  .dw-zoom { bottom: 12px; }
  .dw-zoom__step { display: none !important; }
  .dw-zoom[data-zoomed='false'] { display: none; }

  .dw-panel, .dw-inputs, .dw-results {
    position: relative;
    inset: auto;
    width: auto;
    min-height: 0;
    margin: 0 8px;
    border-radius: var(--sc-radius-card);
    box-shadow: var(--sc-shadow-raised);
    transform: none;
    transition: none;
  }
  .dw-panel[data-open='false'] { display: none; }
  .dw-panel__close, .dw-panel__head--results { display: none; }
  .dw-panel__head { padding: 12px 8px 4px 16px; }
  .dw-panel__body { padding: 0 16px 24px; }
  .dw-results .dw-panel__body { padding-top: 14px; }
  .dw-icon-button { width: 40px; height: 40px; }

  .dw-views {
    grid-row: 3;
    grid-column: 1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
  }
  .dw-view, .dw-view--stage {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 54px;
    padding: 6px 4px;
    font-size: 11.5px;
  }
  .dw-view > span { display: block; }
  .dw-view > em { display: inline-flex; position: absolute; top: 7px; right: 8px; }
  .dw-view[aria-pressed='true'] { background: var(--sc-color-surface-1); box-shadow: var(--sc-shadow-raised); }
}

@media (prefers-reduced-motion: reduce) {
  .dw-meter i, .dw-more__toggle svg, .dw-panel, .dw-panel[data-open='false'], .dw-stage__scroll, .dw-hud, .dw-zoom, .dw-dock { transition: none; }
}

.dw-resultant circle { fill: var(--dw-moment); }
.dw-resultant text { fill: var(--dw-moment) !important; font-family: var(--sc-font-ui); font-weight: 600; font-size: 11px; }

/* ─── Memoria del proyecto ─── */
.dw-memory-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 10px;
  padding: 6px 6px 6px 10px;
  border: 1px solid var(--dw-line);
  border-radius: var(--sc-radius-control, 8px);
  font-size: 11.5px;
}
.dw-memory-status__open {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--dw-muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    color var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-memory-status__open:hover {
  color: var(--dw-ink);
}
.dw-memory-status__open:active {
  transform: var(--sc-press-transform);
}
.dw-memory-status__open span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dw-memory-status__open i { flex: none; width: 7px; height: 7px; border-radius: var(--sc-radius-pill); border: 1.5px solid var(--dw-subtle); }
.dw-memory-status[data-state='saved'] .dw-memory-status__open i { border-color: var(--dw-pass); background: var(--dw-pass); }
.dw-memory-status[data-state='dirty'] .dw-memory-status__open i { border-color: var(--dw-warn); background: var(--dw-warn); }
.dw-memory-status__save {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  min-height: 26px;
  padding: 0 9px;
  border: 1px solid var(--dw-line);
  border-radius: var(--sc-radius-control, 6px);
  background: var(--sc-color-surface-1);
  color: var(--dw-ink);
  font: 600 11px var(--sc-font-ui);
  cursor: pointer;
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    border-color var(--sc-motion-control) var(--sc-ease-standard),
    box-shadow var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-memory-status__save:hover:not(:disabled) {
  border-color: var(--dw-muted);
  transform: translateY(-1px);
}
.dw-memory-status__save:active:not(:disabled) {
  transform: var(--sc-press-transform);
  box-shadow: var(--sc-shadow-inset);
}
.dw-memory-status__open:focus-visible, .dw-memory-status__save:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }

/* El diálogo vive fuera de la mesa (portal): repite las variables que usan sus tablas. */
.dw-memory {
  --dw-ink: var(--sc-color-text-primary);
  --dw-muted: var(--sc-color-text-secondary);
  --dw-subtle: var(--sc-color-text-tertiary, var(--sc-color-text-secondary));
  --dw-line: var(--sc-color-border-soft, var(--sc-color-border));
  --dw-pass: var(--sc-color-state-success);
  --dw-fail: var(--sc-color-state-error);
  --dw-warn: var(--sc-color-state-warning);
  width: min(640px, calc(100vw - 32px));
}
.dw-memory .sc-modal-surface__footer { flex-wrap: wrap; }
.dw-memory__table { font-family: var(--sc-font-ui); }
.dw-memory__table th[scope='row'] { display: grid; gap: 2px; text-align: left; color: var(--dw-ink); }
.dw-memory__table th[scope='row'] strong { font: 600 12.5px/1.3 var(--sc-font-ui); }
.dw-memory__table th[scope='row'] small { color: var(--dw-muted); font: 11px var(--sc-font-ui); }
.dw-memory__table td { vertical-align: middle; font: 500 11.5px var(--sc-font-mono); }
.dw-memory__table td[data-status='pass'] { color: var(--dw-pass); }
.dw-memory__table td[data-status='warning'] { color: var(--dw-warn); }
.dw-memory__table td[data-status='fail'] { color: var(--dw-fail); }
.dw-memory__table tr[data-active] th[scope='row'] strong::after { content: ' · abierto'; color: var(--dw-muted); font-weight: 500; }
.dw-memory__actions { white-space: nowrap; }
.dw-memory__actions { text-align: right; }
.dw-memory__actions .dw-icon-button { display: inline-grid; margin-left: 2px; vertical-align: middle; }
.dw-memory__empty { margin: 4px 0; color: var(--dw-muted); font-size: 13px; line-height: 1.5; }
.dw-memory__notice { margin: 0 0 10px; color: var(--dw-muted); font-size: 12px; }
.dw-memory__confirm { display: grid; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-left: 2px solid var(--dw-warn); background: var(--sc-color-surface-inset); font-size: 12.5px; }
.dw-memory__confirm p { margin: 0; }
.dw-memory__confirm div { display: flex; flex-wrap: wrap; gap: 6px; }
@media (max-width: 840px) {
  /* En tablets y teléfonos el nombre del proyecto y acciones pesan más que deshacer. */
  .workspace-topbar .dw-topbar-history { display: none; }
}
@media (max-width: 480px) {
  .dw-memory .sc-modal-surface__footer .sc-button { flex: 1 1 100%; justify-content: center; }
}
.dw-drawing--wide { max-width: calc(640px * var(--z, 1)); margin-inline: auto; }
.dw-band-zone { fill: var(--dw-moment); opacity: .08; }
.dw-wall--masonry { stroke-dasharray: 4 2; }

/* ─── Acciones automáticas: Proponer, Aplicar ─── */
.dw-inline-action {
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid var(--dw-line);
  border-radius: var(--sc-radius-pill);
  background: var(--sc-color-surface-1);
  color: var(--dw-ink);
  font: 600 11px var(--sc-font-ui);
  cursor: pointer;
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    border-color var(--sc-motion-control) var(--sc-ease-standard),
    box-shadow var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-inline-action:hover:not(:disabled) {
  border-color: var(--dw-muted);
  transform: translateY(-1px);
}
.dw-inline-action:active:not(:disabled) {
  transform: var(--sc-press-transform);
  box-shadow: var(--sc-shadow-inset);
}
.dw-inline-action:disabled { opacity: .45; cursor: default; }
.dw-inline-action:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }
.dw-action-note { margin: 0; color: var(--dw-muted); font-size: 11.5px; line-height: 1.4; }
.dw-slab-apply { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; font: 500 11.5px var(--sc-font-mono); color: var(--dw-muted); }

.dw-column-stub rect { fill: var(--sc-color-surface-2); stroke: var(--dw-ink); stroke-width: 1.1; }
.dw-cloud circle { fill: var(--sc-color-surface-1); stroke: var(--dw-moment); stroke-width: 1.4; opacity: .9; }
.dw-legend li[data-kind='cloud']::before { width: 7px; height: 7px; border: 1.4px solid var(--dw-moment); border-radius: var(--sc-radius-pill); background: var(--sc-color-surface-1); }

/* ─── Pórtico ─── */
.dw-frame { max-width: calc(980px * var(--z, 1)); margin-inline: auto; }
.dw-frame__member { stroke: var(--dw-ink); stroke-width: 4; stroke-linecap: round; }
.dw-frame__member--column { stroke-width: 5; }
.dw-frame__member[data-band='low'] { stroke: var(--dw-subtle); }
.dw-frame__member[data-band='mid'] { stroke: var(--dw-ink); }
.dw-frame__member[data-band='near'] { stroke: var(--fs-signal-attention); }
.dw-frame__member[data-band='fail'] { stroke: var(--dw-fail); stroke-width: 6; }
.dw-frame[data-kind='moment'] .dw-frame__member,
.dw-frame[data-kind='shear'] .dw-frame__member,
.dw-frame[data-kind='axial'] .dw-frame__member,
.dw-frame[data-kind='deformed'] .dw-frame__member { stroke: var(--dw-muted); stroke-width: 2.4; }
.dw-frame__selected { stroke: var(--dw-ink); stroke-width: 12; stroke-linecap: round; opacity: .16; pointer-events: none; }
.dw-frame__nodes circle { fill: var(--sc-color-surface-1); stroke: var(--dw-ink); stroke-width: 1.2; }
.dw-frame__deformed path { fill: none; stroke: var(--dw-deformed); stroke-width: 2.2; stroke-linejoin: round; }
.dw-frame__ratios text { font-weight: 600; font-size: 11px; paint-order: stroke; stroke: var(--sc-color-surface-1); stroke-width: 3px; }
.dw-frame__ratios text[data-band='low'] { fill: var(--dw-muted); }
.dw-frame__ratios text[data-band='near'] { fill: var(--fs-signal-attention-ink, var(--fs-signal-attention)); }
.dw-frame__ratios text[data-band='fail'] { fill: var(--dw-fail); }
.dw-frame__values text { font-weight: 600; font-size: 10.5px; paint-order: stroke; stroke: var(--sc-color-surface-1); stroke-width: 3px; }
.dw-frame__level { fill: var(--dw-muted) !important; font-weight: 600; }
.dw-frame__lateral line { stroke-width: 1.6; }
.dw-frame__hits line { stroke: transparent; stroke-width: 20; stroke-linecap: round; cursor: pointer; pointer-events: stroke; }
.dw-frame__hits line:focus-visible { outline: none; stroke: var(--sc-color-focus); stroke-opacity: .45; }
.dw-frame-legend li[data-kind='low']::before { border-top: 4px solid var(--dw-subtle); }
.dw-frame-legend li[data-kind='mid']::before { border-top: 4px solid var(--dw-ink); }
.dw-frame-legend li[data-kind='near']::before { border-top: 4px solid var(--fs-signal-attention); }
.dw-frame-legend li[data-kind='fail']::before { border-top: 5px solid var(--dw-fail); }

/* Matriz de miembros del pórtico: niveles por filas, viga y columnas por columnas. */
.dw-member-grid { width: 100%; border-collapse: separate; border-spacing: 3px; font-size: 11px; }
.dw-member-grid th { color: var(--dw-muted); font-weight: 600; text-align: center; }
.dw-member-grid th[scope='row'] { text-align: left; font-family: var(--sc-font-mono); }
.dw-member-grid button { width: 100%; min-height: 32px; padding: 2px 4px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-data); background: var(--sc-color-surface-1); color: var(--dw-ink); font: 600 11px var(--sc-font-mono); cursor: pointer; }
.dw-member-grid button[data-band='low'] { color: var(--dw-muted); }
.dw-member-grid button[data-band='near'] { color: var(--fs-signal-attention-ink, var(--fs-signal-attention)); border-color: var(--fs-signal-attention); }
.dw-member-grid button[data-band='fail'] { color: var(--dw-fail); border-color: var(--dw-fail); }
.dw-member-grid button[aria-pressed='true'] { background: var(--sc-color-fill-tertiary, var(--sc-color-surface-2)); border-color: var(--dw-ink); box-shadow: inset 0 0 0 1px var(--dw-ink); }
.dw-frame-diagram__select { display: none; }
@media (max-width: 760px) {
  .dw-frame-diagram__tabs { display: none !important; }
  .dw-frame-diagram__select { display: grid; }
}
.dw-frame__member[data-band='skip'] { stroke: var(--dw-subtle); stroke-dasharray: 5 4; stroke-width: 2; }
.dw-frame-legend li[data-kind='skip']::before { border-top: 2px dashed var(--dw-subtle); }
.dw-inline-action { display: inline-flex; align-items: center; justify-content: center; gap: 5px; }

/* Fichas por nivel: vigas (V, VA, VB…) y columnas (C1, C2…) con su cociente. */
.dw-member-grid td { padding: 0; }
.dw-member-grid__chips { display: flex; flex-wrap: wrap; gap: 3px; }
.dw-member-grid__chips button { display: grid; flex: 1 0 50px; justify-items: center; width: auto; padding: 3px 4px; line-height: 1.2; }
.dw-member-grid__chips span { color: var(--dw-muted); font-weight: 500; font-size: 10px; }
.dw-member-grid__chips b { font-weight: 600; }

/* Fuente «Modelo 2D»: lo que se leyó del modelo y lo que no entra. */
.dw-model-card { display: grid; gap: 8px; margin-top: 8px; padding: 10px 12px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-data); background: var(--sc-color-surface-1); color: var(--dw-muted); font-size: 11.5px; line-height: 1.45; }
.dw-model-card[data-state='error'] { border-color: var(--dw-fail); }
.dw-model-card strong { color: var(--dw-ink); font-size: 12.5px; overflow-wrap: anywhere; }
.dw-model-card dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 14px; margin: 0; }
.dw-model-card dl > div { display: flex; justify-content: space-between; gap: 6px; }
.dw-model-card dl > div:last-child { grid-column: 1 / -1; flex-direction: column; gap: 1px; }
.dw-model-card dd { margin: 0; color: var(--dw-ink); font: 500 11.5px var(--sc-font-mono); }
.dw-model-card p { margin: 0; }
.dw-model-card .dw-inline-action { justify-self: start; }
.dw-model-wait {
  display: flex;
  align-items: center;
  gap: 10px;
  align-self: center;
  margin-top: 40px;
  padding: 14px 16px;
  border-radius: var(--sc-radius-card);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-raised);
  color: var(--dw-muted);
  font-size: 12.5px;
}
.dw-model-wait__dot { width: 8px; height: 8px; border-radius: var(--sc-radius-pill); background: var(--dw-muted); animation: dw-model-pulse 900ms var(--sc-ease-standard) infinite alternate; }
@keyframes dw-model-pulse { from { opacity: .25; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .dw-model-wait__dot { animation: none; } }
.dw-model-errors { display: grid; justify-items: center; gap: 12px; align-self: center; }
.dw-model-confirm { display: grid; gap: 6px; }
.dw-model-confirm p { color: var(--dw-ink); }
.dw-model-confirm div { display: flex; flex-wrap: wrap; gap: 6px; }

/* ─── Edificio: todos los ejes del Modelo 3D (BuildingAxes) ─── */
.dw-building { position: relative; display: grid; gap: 10px; }
.dw-plate:has(.dw-building__close) figcaption { padding-right: 36px; }
.dw-building__close { position: absolute; top: -30px; right: 0; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-control); background: var(--sc-color-surface-1); color: var(--dw-muted); cursor: pointer; }
.dw-building__close:hover { color: var(--dw-ink); }
.dw-building-plan { width: 100%; max-width: calc(560px * var(--z)); max-height: calc(380px * var(--z)); justify-self: center; }
.dw-building-plan__axis { cursor: pointer; outline: none; }
.dw-building-plan__axis line { stroke: var(--dw-subtle); stroke-width: 1.5; stroke-dasharray: 6 4; }
.dw-building-plan__axis line.dw-building-plan__hit { stroke: transparent; stroke-width: 16; stroke-dasharray: none; }
.dw-building-plan__axis circle { fill: var(--sc-color-surface-1); stroke: var(--dw-subtle); stroke-width: 1.5; }
.dw-building-plan__axis text { fill: var(--dw-muted); font: 600 10px var(--sc-font-mono); }
.dw-building-plan__axis[data-band='mid'] :is(line:not(.dw-building-plan__hit), circle) { stroke: var(--dw-ink); }
.dw-building-plan__axis[data-band='near'] :is(line:not(.dw-building-plan__hit), circle) { stroke: var(--fs-signal-attention); }
.dw-building-plan__axis[data-band='fail'] :is(line:not(.dw-building-plan__hit), circle) { stroke: var(--dw-fail); }
.dw-building-plan__axis[data-band='pending'] :is(line:not(.dw-building-plan__hit), circle) { opacity: .55; }
.dw-building-plan__axis[data-current] line:not(.dw-building-plan__hit) { stroke-width: 3; stroke-dasharray: none; }
.dw-building-plan__axis[data-current] text { fill: var(--dw-ink); }
.dw-building-plan__axis:is(:hover, :focus-visible) line:not(.dw-building-plan__hit) { stroke-width: 3; }
.dw-building-plan__axis:focus-visible circle { stroke-width: 3; }
.dw-building-plan__column { fill: var(--sc-color-surface-1); stroke: var(--dw-ink); stroke-width: 1.5; }
.dw-building-plan__column[data-band='low'] { fill: var(--dw-subtle); stroke: var(--dw-subtle); }
.dw-building-plan__column[data-band='mid'] { fill: var(--dw-ink); }
.dw-building-plan__column[data-band='near'] { fill: var(--fs-signal-attention); stroke: var(--fs-signal-attention); }
.dw-building-plan__column[data-band='fail'] { fill: var(--dw-fail); stroke: var(--dw-fail); }
.dw-building-plan__column[data-band='pending'] { stroke-dasharray: 2 2; }
.dw-building__table td[data-band='low'] { color: var(--dw-muted); }
.dw-building__table td[data-band='near'] { color: var(--fs-signal-attention-ink, var(--fs-signal-attention)); }
.dw-building__table td[data-band='fail'] { color: var(--dw-fail); }
.dw-building__table tr[data-active] th { color: var(--dw-ink); font-weight: 600; }
.dw-building__error { color: var(--dw-fail); text-align: left !important; font-family: var(--sc-font-ui); white-space: normal; }
.dw-building__pending { color: var(--dw-subtle); text-align: left !important; font-family: var(--sc-font-ui); }
.dw-building__table .dw-inline-action { min-height: 28px; }
.dw-building__save { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.dw-building__save span { color: var(--dw-muted); font-size: 11px; line-height: 1.5; }

/* Propuesta de secciones del Modelo 2D: se lee y se aplica (o se descarta). */
.dw-proposal {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--dw-line);
  border-radius: var(--sc-radius-md, 10px);
  background: var(--sc-color-surface-1);
}
.dw-proposal p { margin: 0; color: var(--dw-ink); font-size: 11.5px; line-height: 1.5; }
.dw-proposal__actions { display: flex; flex-wrap: wrap; gap: 8px; }
`,S=`.cs-workbench { display: flex; flex: 1; width: 100%; min-width: 0; min-height: 0; }
.cs-workbench .dw-stage__content { align-content: flex-start; }
.cs-intro { display: grid; gap: 7px; margin: 3px 0 15px; }
.cs-intro p { margin: 0; color: var(--dw-muted); font-size: 12px; line-height: 1.6; }
.cs-experimental { display: inline-flex; align-items: center; gap: 6px; width: fit-content; color: var(--dw-warn); font: 600 10px/1.3 var(--sc-font-mono); letter-spacing: .04em; }
.cs-mode { display: flex; gap: 4px; padding: 3px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-control); background: var(--sc-color-surface-1); }
.cs-mode button { min-height: 32px; padding: 5px 9px; border: 0; border-radius: var(--sc-radius-control); background: transparent; color: var(--dw-muted); font: 600 11px/1.3 var(--sc-font-ui); cursor: pointer; }
.cs-mode button[aria-pressed='true'] { background: var(--sc-color-surface-3, var(--sc-color-surface-2)); color: var(--dw-ink); box-shadow: var(--sc-shadow-xs); }
.cs-mode button:focus-visible, .cs-shape:focus-visible, .cs-drawing-tabs button:focus-visible { outline: 2px solid var(--sc-color-focus-ring, var(--dw-ink)); outline-offset: 3px; }
.cs-philosophy-note { grid-column: 1 / -1; margin: 0; color: var(--dw-muted); font-size: 11px; line-height: 1.6; }
.cs-shapes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; grid-column: 1 / -1; }
.cs-shape { display: flex; flex-direction: column; align-items: center; gap: 6px; min-height: 68px; padding: 9px 2px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-control); background: transparent; color: var(--dw-muted); font: 500 10px/1.2 var(--sc-font-ui); cursor: pointer; }
.cs-shape svg { width: 25px; height: 25px; fill: var(--sc-color-surface-2); stroke: currentColor; stroke-width: 1.5; }
.cs-shape[aria-pressed='true'] { background: var(--sc-color-surface-2); border-color: var(--dw-ink); color: var(--dw-ink); }
.cs-shape:hover { border-color: var(--dw-muted); }
.cs-stage { flex: 1 1 100%; width: calc(690px * var(--z)); max-width: calc(950px * var(--z)); min-width: 0; display: grid; gap: calc(24px * var(--z)); }
.cs-sheet-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; padding-bottom: 14px; border-bottom: 1px solid var(--dw-line); }
.cs-sheet-header h2 { margin: 5px 0 0; font: 500 25px/1.2 var(--sc-font-display); letter-spacing: -.04em; }
.cs-sheet-header p { margin: 5px 0 0; color: var(--dw-muted); font-size: 11px; line-height: 1.6; }
.cs-sheet-id { color: var(--dw-muted); font: 500 10px/1.6 var(--sc-font-mono); text-align: right; white-space: nowrap; }
.cs-drawing-tabs { display: flex; flex-wrap: wrap; gap: 3px; width: fit-content; border-bottom: 1px solid var(--dw-line); }
.cs-drawing-tabs button { min-height: 38px; padding: 9px 13px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--dw-muted); font: 500 12px/1.3 var(--sc-font-ui); cursor: pointer; }
.cs-drawing-tabs button[aria-pressed='true'] { border-bottom-color: var(--dw-ink); color: var(--dw-ink); }
.cs-stage .dw-plate { width: 100%; max-width: none; }
.cs-stage .dw-plate figcaption { margin-bottom: 10px; }
.cs-drawing { width: 100%; display: block; overflow: visible; }
.cs-section { max-height: calc(430px * var(--z)); }
.cs-caption { display: flex; flex-wrap: wrap; gap: 10px 20px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--dw-line); color: var(--dw-muted); font: 10px/1.5 var(--sc-font-mono); }
.cs-caption b { color: var(--dw-ink); font-weight: 600; }
.cs-compression { fill: var(--dw-axial); fill-opacity: .14; stroke: none; }
.cs-neutral { stroke: var(--dw-deformed); stroke-width: 1.2; stroke-dasharray: 7 4; }
.cs-strain-line { stroke: var(--dw-deformed); stroke-width: 2; fill: none; }
.cs-stress-line { stroke: var(--dw-axial); stroke-width: 2; fill: none; }
.cs-stress-fill { fill: var(--dw-axial); fill-opacity: .12; }
.cs-area-fill { fill: var(--dw-moment); fill-opacity: .07; stroke: none; }
.cs-bar-selected { stroke: var(--dw-deformed); stroke-width: 2; fill: var(--dw-steel); cursor: pointer; }
.cs-section .dw-bar { cursor: pointer; }
.cs-section .dw-bar:focus { outline: none; stroke: var(--dw-deformed); stroke-width: 2; }
.cs-bar-label { font: 9px var(--sc-font-mono); fill: var(--dw-muted) !important; }
.cs-symbol { font: 500 11px var(--sc-font-mono); }
.cs-drawing .cs-small { font-size: 9px; fill: var(--dw-muted); }
.cs-drawing .cs-label { font-size: 11px; font-weight: 500; }
.cs-demand-detail { color: var(--dw-moment); }
.cs-verdict { margin: 12px 0 10px; padding: 0 0 14px; border-bottom: 1px solid var(--dw-line); }
.cs-verdict__head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-top: 6px; }
.cs-verdict__head strong { font: 600 20px/1.15 var(--sc-font-display); letter-spacing: -.035em; }
.cs-verdict__head > span { color: var(--dw-moment); font: 600 25px/1 var(--sc-font-mono); }
.cs-verdict[data-status='fail'] .cs-verdict__head > span { color: var(--dw-fail); }
.cs-verdict > p { color: var(--dw-muted); font-size: 11px; line-height: 1.6; }
.cs-verdict .dw-meter { margin: 12px 0; }
.cs-verdict .dw-meter i { background: var(--dw-moment); }
.cs-verdict[data-status='fail'] .dw-meter i { background: var(--dw-fail); }
.cs-limitations { margin: 0; padding-left: 15px; color: var(--dw-muted); font-size: 11px; line-height: 1.7; }
.cs-detail-checks { padding: 0; margin: 0; list-style: none; }
.cs-detail-checks li { padding: 9px 0; border-bottom: 1px solid var(--dw-line); }
.cs-detail-checks li > div { display: flex; align-items: center; gap: 7px; font-size: 12px; }
.cs-detail-checks li svg { color: var(--dw-muted); flex: none; }
.cs-detail-checks li[data-status='warning'] svg { color: var(--dw-warn); }
.cs-detail-checks li p { margin: 5px 0 0 22px; color: var(--dw-muted); font-size: 10.5px; line-height: 1.6; }
.cs-check-value { display: block; margin: 5px 0 0 22px; color: var(--dw-ink); font: 10px/1.4 var(--sc-font-mono); }
.cs-direction-note { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 14px; padding: 10px 0; color: var(--dw-warn); font-size: 11px; line-height: 1.6; }
.cs-direction-note svg { flex: none; margin-top: 2px; }
.cs-bar-editor { padding: 9px 0; border-top: 1px solid var(--dw-line); }
.cs-bar-editor__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; font-size: 11px; }
.cs-bar-editor__row button { min-height: 28px; padding: 4px 8px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-control); color: var(--dw-muted); background: transparent; font-size: 10px; cursor: pointer; }
.cs-reference-list { margin: 10px 0 0; padding: 0; list-style: none; color: var(--dw-muted); font-size: 10px; line-height: 1.6; }
.cs-reference-list a { color: inherit; text-decoration-color: var(--dw-line); }
@media (max-width: 760px) {
  .cs-stage { width: calc(560px * var(--z)); }
  .cs-sheet-header { align-items: flex-start; }
  .cs-sheet-header h2 { font-size: 22px; }
  .cs-sheet-id { display: none; }
  .cs-drawing-tabs { gap: 0; }
  .cs-drawing-tabs button { padding-inline: 9px; font-size: 11px; }
  .cs-mode button { min-height: 36px; }
  .cs-shape { min-height: 76px; }
}
@media (prefers-reduced-motion: reduce) { .cs-workbench * { scroll-behavior: auto; } }
`;function C(){return`${/:root\s*\{[\s\S]*?\n\}/.exec(`/*
 * FusionStructure · Fundación visual
 * ---------------------------------------------------------------------------
 * Dirección: MAKE COMPLEXITY LEGIBLE. Papel y carbón; el color es del dominio.
 *
 * Esta es la única capa que declara valores. No hay hoja de parches encima, no
 * hay \`!important\` de reconciliación y no hay una segunda verdad. Editar la
 * identidad de FusionStructure es editar este archivo.
 *
 * Implementa el brandbook de FusionStructure (\`brandbook-site/\`): su papel, su
 * carbón, sus seis señales de dominio y su escala de movimiento. Donde el
 * brandbook publica un valor que no aguanta la prueba de contraste sobre las
 * cuatro superficies del producto, aquí vive el escalón que sí la aguanta y el
 * valor publicado queda como la tinta del tema que lo necesita.
 *
 * LAS CUATRO REGLAS
 * ---------------------------------------------------------------------------
 *  1. EL CHROME ES NEUTRO; LA ACCIÓN IDENTIFICA EL PRODUCTO. Fondos,
 *     superficies, bordes y texto son papel en Día y carbón en Noche. La
 *     acción primaria de FStructure usa el salmón de la familia Análisis. La
 *     temperatura del papel es mínima y constante —la desviación entre canales
 *     nunca pasa de 12— y nunca se convierte en un tinte de marca. El acento es
 *     la tinta misma: carbón sobre papel en Día, papel sobre carbón en Noche.
 *
 *  2. EL COLOR ES DEL DOMINIO. Seis señales entran en la aplicación —axial,
 *     cortante, momento, acción, deformada y aviso— y sólo para significar algo
 *     que el solver o el modelo dicen. Se usan como TRAZO, no como relleno de
 *     superficie. Un panel nunca se tiñe; una línea sí.
 *
 *  3. LA PROFUNDIDAD ES UNA SOLA LUZ. Un borde de 1px sigue delimitando, y
 *     además hay un escalón de arcilla: la luz entra por arriba-izquierda, la
 *     sombra cae abajo-derecha y el contacto claro queda arriba-izquierda. La
 *     luz es del SISTEMA, no de la pieza: ninguna superficie se ilumina sola,
 *     ninguna capa tiñe. Un panel no sube por ser importante; sube porque
 *     tapa contenido.
 *
 *  4. MENOS SUPERFICIE, MENOS TEXTO. Tarjetas pequeñas, filas densas,
 *     etiquetas breves. Lo que se puede decir con una cifra no lleva una
 *     frase. El radio acompaña a la sombra —una esquina dura delata que el
 *     volumen es un adorno pegado—, pero la densidad no se negocia.
 *
 * INVARIANZA POR TEMA
 * ---------------------------------------------------------------------------
 * Las seis señales se declaran UNA sola vez en \`:root\` y no se redefinen en
 * Noche: un momento flector no cambia de significado al apagar la luz. El
 * bloque \`[data-theme='dark']\` sólo puede redefinir neutros —fondos,
 * superficies, filetes, tintas de texto— y las TINTAS de señal y de estado, que
 * se apoyan sobre esas superficies y sí tienen que recalibrarse para seguir
 * legibles.
 *
 * Capas de este archivo:
 *   1. Primitivas — la rampa de papel y las seis señales.
 *   2. Roles semánticos de interfaz (Día).
 *   3. Roles técnicos del dominio (invariantes).
 *   4. Espaciado, tamaños y forma.
 *   5. Materia: el filete, y un escalón de arcilla con una sola luz.
 *   6. Tipografía.
 *   7. Controles, layout y densidad.
 *   8. Motion y apilamiento.
 *   9. Alias de compatibilidad para el CSS existente.
 *  10. Tema Noche.
 */
:root {
  /* ------------------------------------------------------------------ */
  /* 1 · PRIMITIVAS                                                      */
  /* ------------------------------------------------------------------ */

  /* PAPEL Y TINTA. Valores literales de \`FusionStructureBrand/app/globals.css\`.
     Los escalones históricos que no existen en el brandbook apuntan al vecino
     canónico más próximo; no introducen una paleta paralela. */
  --sc-white: #ffffff;
  --sc-black: #000000;
  --fs-paper-0: #fffefa;
  --fs-paper-25: #fffefa;
  --fs-paper-50: #f7f6f1;
  --fs-paper-100: #edefe9;
  --fs-paper-150: #edefe9;
  --fs-paper-200: #dde2dc;
  --fs-paper-300: #c6cdc6;
  --fs-paper-400: #a7b1a9;
  --fs-paper-500: #7e8a84;
  --fs-paper-600: #5c6a6f;
  --fs-paper-700: #3f4a50;
  --fs-paper-800: #3f4a50;
  --fs-paper-900: #14171a;
  --fs-paper-950: #14171a;

  /* Alias históricos de la rampa. El producto entero los usa; conservarlos
     evita una migración mecánica sin lectura en cada hoja de feature. */
  --fs-gray-0: var(--fs-paper-0);
  --fs-gray-25: var(--fs-paper-25);
  --fs-gray-50: var(--fs-paper-50);
  --fs-gray-100: var(--fs-paper-100);
  --fs-gray-150: var(--fs-paper-150);
  --fs-gray-200: var(--fs-paper-200);
  --fs-gray-300: var(--fs-paper-300);
  --fs-gray-400: var(--fs-paper-400);
  --fs-gray-500: var(--fs-paper-500);
  --fs-gray-600: var(--fs-paper-600);
  --fs-gray-700: var(--fs-paper-700);
  --fs-gray-800: var(--fs-paper-800);
  --fs-gray-900: var(--fs-paper-900);
  --fs-gray-950: var(--fs-paper-950);

  /* LAS SEIS SEÑALES DEL BRANDBOOK, con su par Día/Noche.
     ---------------------------------------------------------------------
     Hasta ahora la señal era un TRAZO invariante por tema más una TINTA que sí
     se recalibraba: un cortante era el mismo verde con la luz encendida o
     apagada. Era una regla defendible y era la nuestra, no la del brandbook,
     que publica doce valores —seis por tema— porque un mismo hex no puede
     estar medido a la vez contra papel y contra carbón.

     Se adopta la del brandbook. El valor se recalibra en Noche y con eso
     desaparece la distinción trazo/tinta: el valor de Día ya está en escalón
     de tinta sobre papel (≥5:1 medido sobre \`--fs-paper-25\`) y el de Noche
     sobre carbón, así que la misma variable sirve para la línea del diagrama y
     para la cifra que la nombra. \`-ink\` sigue existiendo como alias para los
     dos centenares de roles que ya lo nombran.

     Lo que cambia de significado, y no sólo de valor:
       · \`moment\` pasa de rosa a ROJO — es el rojo del brandbook;
       · el rosa que era \`moment\` es ahora \`yield\`, una señal nueva: fluencia;
       · \`alert\` se llama \`attention\`, que es como lo publica el brandbook.
     \`action\` deja de ser una señal de dominio y queda como el rol de acción
     destructiva del chrome, apuntando al mismo rojo. Las CARGAS, que eran su
     otro uso, ya no viven aquí: son su propia familia, más abajo. */
  --fs-signal-axial: #0f95d1;
  --fs-signal-moment: #ed4b46;
  --fs-signal-shear: #468c09;
  --fs-signal-deformed: #8b5cf6;
  --fs-signal-yield: #d85ac9;
  --fs-signal-attention: #d9720a;

  /* Registro de la marca madre: rojo pastel, separado del rojo técnico de
     momento para que el logo no parezca un resultado del solver. */
  --fs-brand-register: #1aa57a;

  /* Con el par Día/Noche, la tinta ES la señal. Se conservan los nombres para
     no reescribir los roles que los consumen. */
  --fs-signal-axial-ink: var(--fs-signal-axial);
  --fs-signal-shear-ink: var(--fs-signal-shear);
  --fs-signal-moment-ink: var(--fs-signal-moment);
  --fs-signal-deformed-ink: var(--fs-signal-deformed);
  --fs-signal-yield-ink: var(--fs-signal-yield);
  --fs-signal-attention-ink: var(--fs-signal-attention);

  /* Alias de migración. \`alert\` era el nombre viejo de \`attention\`; \`action\` es
     el rol destructivo del chrome, que comparte el rojo del momento porque
     nunca comparten campo visual: uno es cromo, el otro es lienzo. */
  --fs-signal-alert: var(--fs-signal-attention);
  --fs-signal-alert-ink: var(--fs-signal-attention);
  --fs-signal-action: var(--fs-signal-moment);
  --fs-signal-action-ink: var(--fs-signal-moment);

  /* LA SÉPTIMA FAMILIA · LAS CARGAS, VIVAS.
     ---------------------------------------------------------------------
     El brandbook no publica ninguna señal para una carga aplicada: sus seis
     significados son todos respuesta de la estructura. Antes las tres cargas
     compartían el rojo de \`action\`, y con el rojo pasando a \`moment\` habrían
     quedado del mismo color que el diagrama de momento. Así que son una
     familia propia, con los hues que el usuario les asignó: puntual azul,
     distribuida roja, momento verde.

     Lo que cambia aquí es el CROMA. La versión anterior distinguía la carga de
     la señal de su mismo tono apagándola —croma 48-68 frente a 79-149— y el
     resultado, medido en pantalla, era una entrada del modelo que se leía como
     una mancha sucia: lo que el usuario dibuja, que es el dato que él mismo
     introdujo, no puede ser lo más apagado del lienzo. Ahora la carga es viva
     (croma 155-216) y lo que la separa de su señal ya no es la saturación sino
     la DISTANCIA de color: cobalto contra azur, bermellón contra ladrillo,
     esmeralda contra verde bosque, con ≥55 de separación RGB frente a las seis
     señales, que es la misma que tenía la familia apagada. La guarda vive en
     \`designSystem.test.ts\` y mide las dos cosas: separación y 3:1 sobre el
     papel de su tema.

     Los valores de Día están medidos sobre \`#fffefa\` y los de Noche sobre
     carbón: un mismo hex no puede estar medido a la vez contra los dos. */
  --fs-load-point: #1a4fe0;
  --fs-load-distributed: #ee5116;
  --fs-load-moment: #009b7a;

  /* Alias de dominio por hue. El código existente nombra los colores por su
     familia; el sistema los nombra por su significado. Ambos apuntan al mismo
     valor para que no existan dos verdades. */
  --fs-red: var(--fs-signal-moment);
  --fs-blue: var(--fs-signal-axial);
  --fs-green: var(--fs-signal-shear);
  --fs-yellow: var(--fs-signal-attention);
  --fs-pink: var(--fs-signal-yield);
  --fs-purple: var(--fs-signal-deformed);

  --fs-red-ink: var(--fs-signal-moment);
  --fs-blue-ink: var(--fs-signal-axial);
  --fs-green-ink: var(--fs-signal-shear);
  --fs-yellow-ink: var(--fs-signal-attention);
  --fs-pink-ink: var(--fs-signal-yield);
  --fs-purple-ink: var(--fs-signal-deformed);

  /* LAS SIETE FAMILIAS DE HERRAMIENTA y LOS CUATRO ESTADOS DE MADUREZ.
     ---------------------------------------------------------------------
     Dos escalas que el brandbook publica y que el producto no tenía. La
     familia dice a qué parte del sistema pertenece una herramienta; el estado
     dice cuánto se puede confiar en ella, que en un producto experimental es
     información de primer orden y no una etiqueta decorativa. */
  --fs-family-nucleo: #1aa57a;
  --fs-family-analisis: #ed4b46;
  --fs-family-modelo: #7657d5;
  --fs-family-civil: #468c09;
  --fs-family-proyecto: #d9720a;
  --fs-family-interop: #3a72e3;
  --fs-family-aprendizaje: #c94a8f;

  --fs-status-disponible: #277654;
  --fs-status-experimental: #8a6110;
  --fs-status-planeado: #5c6a6f;
  --fs-status-no-comprometido: #a7b1a9;

  /* ------------------------------------------------------------------ */
  /* 2 · ROLES SEMÁNTICOS DE INTERFAZ — TEMA DÍA                         */
  /* ------------------------------------------------------------------ */
  /* Cuatro planos y nada más: la aplicación, la superficie, el hueco y el
     pulsado. Todo lo demás son alias de estos cuatro. */
  --sc-color-bg-app: var(--fs-paper-50);
  --sc-color-bg-canvas: var(--fs-paper-25);
  --sc-color-surface-1: var(--fs-paper-0);
  --sc-color-surface-2: var(--fs-paper-100);
  --sc-color-surface-3: var(--fs-paper-100);
  --sc-color-surface-elevated: var(--fs-paper-0);
  --sc-color-surface-floating: var(--fs-paper-0);
  --sc-color-surface-inset: var(--fs-paper-100);
  --sc-color-surface-pressed: var(--fs-paper-150);
  --sc-color-surface-toolbar: var(--fs-paper-0);
  --sc-color-surface-input: var(--fs-paper-0);

  /* Rellenos suaves: la escala de "casi nada" con la que se agrupa sin dibujar
     una tarjeta. Son grises, nunca tintes de marca. */
  --sc-color-fill-primary: var(--fs-gray-100);
  --sc-color-fill-secondary: var(--fs-gray-50);
  --sc-color-fill-tertiary: var(--fs-gray-25);
  --sc-color-fill-quaternary: var(--fs-gray-25);

  /* Tintas. La jerarquía la lleva el valor, no el color. */
  --sc-color-text-primary: var(--fs-gray-950);
  --sc-color-text-secondary: var(--fs-gray-700);
  --sc-color-text-muted: var(--fs-gray-600);
  --sc-color-text-tertiary: var(--fs-gray-600);
  --sc-color-text-subtle: var(--fs-gray-500);
  --sc-color-text-technical: var(--fs-gray-800);
  --sc-color-text-unit: var(--fs-gray-600);
  --sc-color-text-disabled: var(--fs-gray-400);
  /* Un control apagado que SIGUE mostrando contenido obligatorio —el valor y su
     unidad dentro de un campo inactivo— no se acoge a la exención de WCAG 1.4.3
     para componentes inactivos: ese texto hay que poder leerlo. 5,74:1. */
  --sc-color-text-disabled-content: var(--fs-gray-700);
  --sc-color-text-inverse: var(--fs-gray-0);
  --sc-color-text-on-action: var(--fs-gray-0);
  /* Un enlace no se distingue por color en este sistema: lo hace por subrayado
     y por peso. La tinta es la misma del texto. */
  --sc-color-text-link: var(--fs-gray-950);

  /* Filetes. Tres pesos: el que separa datos, el que dibuja un control y el que
     tiene que sobrevivir encima del lienzo. */
  --sc-color-border-soft: var(--fs-gray-150);
  --sc-color-border: var(--fs-gray-200);
  --sc-color-border-strong: var(--fs-gray-400);
  --sc-color-divider: var(--fs-gray-150);
  /* El chrome que flota sobre el dibujo técnico necesita un filete que no
     desaparezca contra el lienzo blanco ni contra una línea de diagrama. */
  --sc-color-border-canvas-chrome: var(--fs-gray-400);

  /* ---- ACCIÓN: FStructure pertenece a la familia Análisis --------------
     En este producto la acción primaria adopta el salmón de su marca. No se
     presta a resultados: aparece sólo en controles que ejecutan una decisión.
     La etiqueta es carbón porque el blanco no alcanza contraste sobre salmón. */
  --sc-color-action-primary: var(--fs-family-analisis);
  --sc-color-action-hover: color-mix(in srgb, var(--fs-family-analisis) 88%, var(--sc-color-text-primary));
  --sc-color-action-pressed: color-mix(in srgb, var(--fs-family-analisis) 78%, var(--sc-color-text-primary));
  --sc-color-action-foreground: #14171a;
  --sc-color-action-edge: var(--fs-family-analisis);
  --sc-color-action-ink: #c23a33;
  --sc-color-action-ink-on-soft: #c23a33;
  --sc-color-action-subtle: var(--fs-gray-50);
  --sc-color-brand: var(--fs-family-analisis);
  --sc-color-brand-secondary: var(--fs-gray-700);
  --sc-color-brand-register: var(--fs-brand-register);
  --sc-color-accent-blue-soft: var(--fs-gray-50);
  --sc-color-accent-violet-soft: var(--fs-gray-50);

  /* Foco usa el registro del producto y siempre conserva separación física. */
  --sc-color-focus: var(--fs-family-analisis);
  --sc-color-selection: var(--fs-gray-100);
  --sc-color-selection-stroke: var(--fs-gray-950);
  --sc-color-selection-outline: var(--fs-gray-950);
  /* Informativo es dominio (dice algo del modelo), así que sí lleva hue. */
  --sc-color-info: var(--fs-blue);

  /* ---- ESTADOS -------------------------------------------------------
     Cuatro de los cinco hues trabajan aquí, y sólo aquí dentro del chrome: un
     estado es información del sistema, no decoración. Se usan como trazo,
     punto o filete —nunca como fondo de un panel entero. */
  --sc-color-state-success: var(--fs-green);
  --sc-color-state-warning: var(--fs-yellow);
  --sc-color-state-error: var(--fs-red);
  --sc-color-state-critical: var(--fs-red-ink);
  --sc-color-state-info: var(--fs-blue);
  --sc-color-state-stale: var(--fs-yellow);
  --sc-color-state-loading: var(--fs-gray-500);
  --sc-color-state-pending: var(--fs-gray-500);
  /* Tintas de estado: el mismo hue en el escalón que un texto necesita. Éstas
     SÍ se recalibran en Noche, porque su fondo cambia. */
  --sc-color-state-success-foreground: var(--fs-green-ink);
  --sc-color-state-warning-foreground: var(--fs-yellow-ink);
  --sc-color-state-error-foreground: var(--fs-red-ink);

  /* Rellenos plenos de estado. Existen para el caso —raro— en que un estado
     tiene que gritar: un error bloqueante. Llevan su propia tinta encima. */
  --sc-color-success-solid: var(--fs-green-ink);
  --sc-color-success-on-solid: var(--fs-gray-0);
  --sc-color-error-solid: var(--fs-red-ink);
  --sc-color-error-on-solid: var(--fs-gray-0);
  --sc-color-on-signal: var(--fs-gray-0);

  /* Canario: el amarillo de relleno pleno, con su tinta encima. Deja de
     declarar un hex propio —era el trazo amarillo del sistema anterior— y toma
     el valor de Noche de \`attention\`, que es el amarillo del brandbook y el
     único escalón en el que un amarillo es visible como superficie. */
  --sc-color-canario: #f3c553;
  --sc-color-canario-ink: var(--fs-signal-attention);

  /* Aula es un acento de EXPERIENCIA —a quién le habla la app—, no un resultado
     del solver. Se queda con el rosa para no compartir hue con ninguna acción
     interna. */
  --sc-color-aula: var(--fs-pink);
  --sc-color-aula-solid: var(--fs-pink-ink);
  --sc-color-aula-foreground: var(--fs-gray-0);

  /* Lienzo y documento. La rejilla es lo más tenue que dibuja la aplicación:
     tiene que estar sin que se vea. */
  --sc-color-canvas-grid: #edece6;
  --sc-color-canvas-grid-strong: #dfded6;
  --sc-color-canvas-member: var(--fs-gray-950);
  --sc-color-canvas-node-fill: var(--fs-gray-0);
  --sc-color-overlay-soft: rgb(23 26 28 / .16);
  --sc-color-overlay-sheet: rgb(23 26 28 / .26);
  --sc-color-overlay-strong: rgb(23 26 28 / .42);

  /* Materiales de ilustración (el pórtico de la bienvenida). Los nombres son
     históricos; el significado ya es acromático. */
  --sc-color-illustration-ivory: var(--fs-gray-50);
  --sc-color-illustration-ivory-deep: var(--fs-gray-150);
  --sc-color-illustration-lime: var(--fs-gray-800);
  --sc-color-illustration-lime-deep: var(--fs-gray-950);

  /* ------------------------------------------------------------------ */
  /* 3 · ROLES TÉCNICOS DEL DOMINIO — INVARIANTES POR TEMA               */
  /* ------------------------------------------------------------------ */
  /* Aquí vive TODO el color de la aplicación. La asignación es mnemotécnica y
     no se negocia por pantalla:
       AZUL     · N, axial, y la deformada (desplazamiento)
       VERDE    · V, cortante, y las reacciones (la respuesta del apoyo)
       ROJO     · M, momento flector
       ROSA     · fluencia
       VIOLETA  · deformada
       AMARILLO · cotas, geometría de referencia y dato incompleto
     Y, aparte de las seis, la familia pastel de lo que se APLICA a la
     estructura: azul apagado la puntual, rojo apagado la distribuida, verde
     apagado el momento aplicado.

     Ya no es «un mismo HEX en Día y en Noche»: cada valor tiene su par, porque
     ningún hex puede estar medido a la vez contra papel y contra carbón. Lo
     invariante es el SIGNIFICADO. */

  /* Acciones aplicadas — la familia pastel. Cada carga con su tono, para que
     una puntual no se confunda con una distribuida ni con un momento
     aplicado, que es lo que pasaba cuando las tres eran el mismo rojo. */
  --sc-color-load-point: var(--fs-load-point);
  --sc-color-load-distributed: var(--fs-load-distributed);
  --sc-color-load-moment-applied: var(--fs-load-moment);
  --sc-color-load-moment: var(--fs-load-moment);
  --sc-color-technical-load: var(--fs-load-point);
  --sc-color-technical-distributed: var(--fs-load-distributed);
  --sc-color-technical-distributed-area: color-mix(in srgb, var(--fs-load-distributed) 12%, transparent);

  /* Acciones internas — AZUL / VERDE / ROSA. */
  /* Tinta de señal: el escalón que necesita una cifra, una etiqueta o una
     leyenda. El trazo (arriba) es invariante; la tinta se recalibra en Noche
     porque cambia el papel debajo, no el significado encima. */
  --sc-color-signal-axial-ink: var(--fs-signal-axial-ink);
  --sc-color-signal-shear-ink: var(--fs-signal-shear-ink);
  --sc-color-signal-moment-ink: var(--fs-signal-moment-ink);
  --sc-color-signal-action-ink: var(--fs-signal-action-ink);
  --sc-color-signal-deformed-ink: var(--fs-signal-deformed-ink);
  --sc-color-signal-yield-ink: var(--fs-signal-yield-ink);
  --sc-color-signal-alert-ink: var(--fs-signal-alert-ink);
  --sc-color-signal-attention-ink: var(--fs-signal-attention-ink);

  /* Familias y estados como roles. El \`-ink\` no existe aquí: el valor ya está
     en escalón de tinta contra el papel de su tema. */
  --sc-color-family-nucleo: var(--fs-family-nucleo);
  --sc-color-family-analisis: var(--fs-family-analisis);
  --sc-color-family-modelo: var(--fs-family-modelo);
  --sc-color-family-civil: var(--fs-family-civil);
  --sc-color-family-proyecto: var(--fs-family-proyecto);
  --sc-color-family-interop: var(--fs-family-interop);
  --sc-color-family-aprendizaje: var(--fs-family-aprendizaje);

  --sc-color-status-disponible: var(--fs-status-disponible);
  --sc-color-status-experimental: var(--fs-status-experimental);
  --sc-color-status-planeado: var(--fs-status-planeado);
  --sc-color-status-no-comprometido: var(--fs-status-no-comprometido);

  --sc-color-technical-axial: var(--fs-blue);
  --sc-color-technical-shear: var(--fs-green);
  --sc-color-technical-shear-area: rgb(39 118 84 / .12);
  --sc-color-technical-moment: var(--fs-signal-moment);
  --sc-color-technical-deformed: var(--fs-purple);
  /* Fluencia. El mapa de demanda ya pintaba con esta señal la barra que
     alcanza su Fy; el rol faltaba, así que la ficha del riel que lo
     enciende no tenía de dónde tomar su color. */
  --sc-color-technical-yield: var(--fs-signal-yield);
  --sc-color-technical-reaction: var(--fs-green);

  /* Referencia geométrica — AMARILLO y tinta. */
  --sc-color-technical-dimension: var(--fs-yellow-ink);
  --sc-color-technical-axis: var(--fs-gray-400);

  /* Rampa del índice elástico. Es una escala SECUENCIAL —dice cuánta demanda
     hay, no si es aceptable—, así que no puede ser un semáforo. Se recorre en
     valor sobre un único hue azul, y el punto de referencia (η alcanza el Fy
     declarado) es el único escalón que cambia de familia. */
  --sc-color-demand-base: #a8d5f4;
  --sc-color-demand-peak: #1668b0;
  --sc-color-demand-reference: var(--fs-pink);
  --sc-color-demand-reference-peak: var(--fs-pink-ink);
  --sc-color-demand-unevaluated: var(--fs-gray-400);

  /* Roles estructurales. La estructura en reposo es TINTA: un pórtico sin
     resultados no tiene por qué llevar color. */
  --sc-color-structure-member: var(--sc-color-canvas-member);
  --sc-color-structure-member-selected: var(--sc-color-selection-stroke);
  --sc-color-structure-node: var(--sc-color-canvas-member);
  --sc-color-structure-node-selected: var(--sc-color-selection-stroke);
  --sc-color-structure-support: var(--sc-color-canvas-member);
  --sc-color-structure-spring: var(--fs-gray-500);
  --sc-color-structure-hinge: var(--fs-gray-500);
  --sc-color-structure-release: var(--fs-gray-500);

  --sc-color-reaction: var(--sc-color-technical-reaction);
  --sc-color-axial-tension: var(--fs-blue);
  --sc-color-axial-compression: var(--fs-blue-ink);
  --sc-color-shear-positive: var(--fs-green);
  --sc-color-shear-negative: var(--fs-green);
  --sc-color-moment-positive: var(--fs-signal-moment);
  --sc-color-moment-negative: var(--fs-signal-moment);
  --sc-color-deformation: var(--fs-purple);
  /* Influencia: área rosa muy diluida con canto rosa. El consumidor mantiene
     \`stroke-dasharray\`; el patrón acompaña al contraste, no lo sustituye. */
  --sc-color-influence-area: rgb(180 74 126 / .13);
  --sc-color-influence-line: var(--fs-signal-yield);
  --sc-color-envelope: var(--fs-gray-500);
  --sc-color-critical-point: var(--fs-yellow-ink);
  --sc-color-geometry-error: var(--fs-red);
  --sc-color-stale-result: var(--fs-yellow-ink);
  /* Snap y hover técnico son ayudas de edición, no resultados: tinta. */
  --sc-color-snap-target: var(--fs-gray-950);
  --sc-color-hover-target: var(--fs-gray-950);

  /* Identificación de herramientas: refleja exactamente la codificación del
     lienzo, para que la herramienta y lo que dibuja compartan color.

     Estos valores se pintan sobre el CHROME —una tecla de 48px en la consola—,
     no sobre el lienzo, y el chrome tiene su propio papel. Antes tomaban el
     valor de trazo tal cual y en Día se quedaban en 2,9–3,4:1 sobre
     \`--fs-paper-25\`: por eso los iconos no elegidos se perdían. Ahora cada uno
     apunta a un valor medido contra el papel de su tema. */
  --sc-color-tool-navigation: var(--sc-color-text-secondary);
  --sc-color-tool-structure: var(--sc-color-text-primary);
  --sc-color-tool-point-load: var(--fs-load-point);
  --sc-color-tool-distributed-load: var(--fs-load-distributed);
  --sc-color-tool-moment: var(--fs-load-moment);
  --sc-color-tool-dimension: var(--fs-signal-attention);
  --sc-color-tool-cut: var(--fs-gray-700);
  --sc-color-tool-destructive: var(--fs-signal-moment);

  /* ------------------------------------------------------------------ */
  /* 4 · ESPACIADO, TAMAÑOS Y FORMA                                      */
  /* ------------------------------------------------------------------ */
  /* Escala de 4px. El minimalismo denso vive en los tres primeros escalones;
     los grandes son para separar secciones, no para airear controles. */
  --sc-space-1: 4px;
  --sc-space-2: 8px;
  --sc-space-3: 12px;
  --sc-space-4: 16px;
  --sc-space-5: 20px;
  --sc-space-6: 24px;
  --sc-space-7: 32px;
  --sc-space-8: 40px;

  --sc-size-icon-sm: 14px;
  --sc-size-icon-md: 16px;
  --sc-size-icon-lg: 20px;
  --sc-size-icon-tool: 18px;
  --sc-size-target-pointer: 30px;
  --sc-size-target-touch: 44px;

  --sc-border-width: 1px;
  --sc-border-width-strong: 1px;
  --sc-hairline: 1px solid var(--sc-color-border-soft);
  /* El anillo de foco es fino y separado: a 2px del control se lee sobre
     cualquiera de los cuatro planos sin engordar el control. */
  --sc-focus-ring-width: 2px;
  --sc-focus-ring-width-compact: 2px;
  --sc-focus-ring-offset: 2px;

  /* ---- RADIOS · escala literal del brandbook web --------------------- */
  --sc-radius-data: 6px;
  --sc-radius-control: 12px;
  --sc-radius-card: 18px;
  --sc-radius-panel: 24px;
  --sc-radius-modal: 24px;
  --sc-radius-sheet: 18px;
  --sc-radius-pill: 999px;

  /* Alias de migración. Ninguno declara valor propio. */
  --sc-radius-xs: var(--sc-radius-control);
  --sc-radius-sm: var(--sc-radius-control);
  --sc-radius-md: var(--sc-radius-control);
  --sc-radius-lg: var(--sc-radius-card);
  --sc-radius-xl: var(--sc-radius-panel);
  --sc-radius-2xl: var(--sc-radius-panel);
  --sc-radius-hero: var(--sc-radius-panel);

  /* ------------------------------------------------------------------ */
  /* 5 · MATERIA · copia semántica de \`app/globals.css\`                  */
  /* ------------------------------------------------------------------ */
  --sc-clay-light: rgb(255 255 255 / 85%);
  --sc-clay-dark: rgb(20 23 26 / 14%);
  --sc-clay-dark-soft: rgb(20 23 26 / 8%);
  --sc-clay-dark-strong: rgb(20 23 26 / 22%);
  --sc-clay-veil: rgb(20 23 26 / 45%);

  --sc-shadow-raised: 2px 4px 7px -1px var(--sc-clay-dark), 1px 1px 2px var(--sc-clay-dark), inset 1.5px 1.5px 2px var(--sc-clay-light), inset -2px -2px 4px var(--sc-clay-dark-soft);
  --sc-shadow-lifted: 5px 10px 16px -2px var(--sc-clay-dark-strong), 2px 3px 5px var(--sc-clay-dark), inset 2px 2px 3px var(--sc-clay-light);
  --sc-shadow-xs: 1px 2px 4px -1px var(--sc-clay-dark), inset 1px 1px 1.5px var(--sc-clay-light), inset -1px -1px 2px var(--sc-clay-dark-soft);
  --sc-shadow-sm: var(--sc-shadow-raised);
  --sc-shadow-md: var(--sc-shadow-raised);
  --sc-shadow-inset: inset 2px 2.5px 5px var(--sc-clay-dark), inset -1.5px -1.5px 3px var(--sc-clay-light);
  --sc-shadow-selected: inset 2px 2.5px 5px var(--sc-clay-dark), inset -1px -1px 2px var(--sc-clay-light), 0 0 0 1.5px var(--fs-family-analisis);
  --sc-shadow-pressed: var(--sc-shadow-inset);
  --sc-shadow-action: var(--sc-shadow-raised);
  --sc-shadow-action-hover: 4px 8px 14px -2px var(--sc-clay-dark-strong), 1px 2px 4px var(--sc-clay-dark), inset 1.5px 1.5px 2px var(--sc-clay-light), inset -2px -2px 4px var(--sc-clay-dark-soft);
  --sc-shadow-action-pressed: var(--sc-shadow-inset);
  --sc-shadow-lg: 4px 8px 14px -2px var(--sc-clay-dark-strong), 1px 2px 4px var(--sc-clay-dark), inset 1.5px 1.5px 2px var(--sc-clay-light), inset -2px -2px 4px var(--sc-clay-dark-soft);
  --sc-shadow-floating: var(--sc-shadow-lg);
  --sc-shadow-popover: var(--sc-shadow-lg);
  --sc-shadow-modal: var(--sc-shadow-lifted);
  --sc-shadow-sheet: 0 -6px 12px -2px var(--sc-clay-dark-strong), inset 1px 1px 2px var(--sc-clay-light);
  --sc-shadow-drop: 0 6px 12px var(--sc-clay-dark-strong);
  --sc-shadow-veil: 0 0 0 2000px var(--sc-clay-veil);

  /* Contrato público de materia: cuatro niveles, cada uno con su distancia.
     El filete de 1px no se va a ninguna parte —sigue siendo lo que delimita—;
     lo que cambia es que ahora además hay una distancia que leer. */
  --sc-depth-base-border: 1px solid var(--sc-color-border-soft);
  --sc-depth-base-shadow: none;
  --sc-depth-inset-border: 1px solid var(--sc-color-border-soft);
  --sc-depth-inset-shadow: var(--sc-shadow-inset);
  --sc-depth-raised-border: 1px solid var(--sc-color-border-soft);
  --sc-depth-raised-shadow: var(--sc-shadow-raised);
  --sc-depth-floating-border: 1px solid var(--sc-color-border);
  --sc-depth-floating-shadow: var(--sc-shadow-lg);

  --sc-surface-edge: 1px solid var(--sc-color-border-soft);
  --sc-surface-fill: var(--sc-color-surface-1);
  --sc-surface-fill-action: var(--sc-color-action-primary);

  --sc-press-transform: translateY(1.5px);
  --sc-press-transform-flat: translateY(1.5px);

  /* La luz es del sistema, no de la pieza: sigue sin haber anillo interior de
     brillo, ni glow, ni degradado. Una cosa es un escalón de contacto y otra
     que cada superficie finja su propia fuente. */
  --sc-ring-inset: none;
  --sc-ring-focus: 0 0 0 var(--sc-focus-ring-width) var(--sc-color-focus);
  --sc-glow-accent: none;
  --sc-glow-aula: none;
  --sc-gradient-brand-soft: none;
  --sc-gradient-display: none;
  --sc-gradient-sheen: none;

  /* ------------------------------------------------------------------ */
  /* 6 · TIPOGRAFÍA                                                      */
  /* ------------------------------------------------------------------ */
  /* Familias literales del brandbook web. */
  --sc-font-ui: "Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --sc-font-display: "Space Grotesk Variable", "Space Grotesk", "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif;
  --sc-font-heading: var(--sc-font-display);
  --sc-font-sans: var(--sc-font-ui);
  --sc-font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", "Cascadia Code", monospace;

  --sc-font-weight-regular: 400;
  --sc-font-weight-medium: 500;
  --sc-font-weight-semibold: 600;
  --sc-font-weight-bold: 650;
  --sc-font-weight-heavy: 700;
  --sc-font-weight-display: 600;

  /* Escala corta y densa. El sistema anterior abría hasta 40px de display; sin
     color ni sombra que ordenen la pantalla, el tamaño es el instrumento de
     jerarquía que queda, y por eso se usa con más disciplina, no con más rango. */
  --sc-font-size-display-xl: 26px;
  --sc-font-size-display-md: 19px;
  --sc-font-size-screen: 16px;
  --sc-font-size-title: 15px;
  --sc-font-size-subtitle: 13px;
  --sc-font-size-lead: 13px;
  --sc-font-size-panel: 12.5px;
  --sc-font-size-body: 12.5px;
  --sc-font-size-control: 12px;
  --sc-font-size-technical: 11.5px;
  --sc-font-size-caption: 11px;
  --sc-font-size-label: 10px;
  --sc-font-size-xs: 10px;

  --sc-line-height-display: 1.1;
  --sc-line-height-tight: 1.2;
  --sc-line-height-compact: 1.35;
  --sc-line-height-control: 1.2;
  --sc-line-height-body: 1.5;
  --sc-line-height-relaxed: 1.6;

  --sc-tracking-display: -0.03em;
  --sc-tracking-tight: -0.02em;
  --sc-tracking-control: -0.01em;
  --sc-tracking-technical: 0;
  --sc-tracking-eyebrow: 0.09em;
  --sc-tracking-wide: 0.06em;

  /* Cifras tabulares en todas partes. No es una opción de componente. */
  --sc-numeric-variant: tabular-nums;
  --sc-numeric-features: "tnum" 1, "cv01" 1;

  /* ------------------------------------------------------------------ */
  /* 7 · CONTROLES, LAYOUT Y DENSIDAD                                    */
  /* ------------------------------------------------------------------ */
  /* Controles más bajos que en cualquiera de los dos productos de origen. Con
     el filete de 1px como único delimitador, un control de 36px se lee vacío. */
  --sc-control-height-sm: 24px;
  --sc-control-height-md: 28px;
  --sc-control-height-touch: 44px;

  --sc-density-row-compact: 24px;
  --sc-density-row: 28px;
  --sc-density-row-comfortable: 32px;
  --sc-density-row-touch: 44px;

  /* Marco de la aplicación. La barra baja de 58px a 44px y el riel deja de
     llevar texto: es un dock de iconos. */
  --sc-layout-topbar: 44px;
  /* El riel es un dock de iconos en toda composición: 38px de tecla + 4px de
     aire a cada lado + el filete. Ya no hay una variante «con etiqueta». */
  --sc-layout-rail: 48px;
  --sc-layout-rail-compact: 48px;
  --sc-layout-inspector: 300px;
  --sc-layout-inspector-compact: 272px;
  --sc-layout-results: 248px;
  --sc-layout-gutter: 12px;
  --sc-layout-reading: 68ch;

  /* ------------------------------------------------------------------ */
  /* 8 · MOTION Y APILAMIENTO                                            */
  /* ------------------------------------------------------------------ */
  /* LA ESCALA DEL BRANDBOOK, ahora con sus valores. Seis duraciones con un
     trabajo cada una: Instante acusa recibo, Rápido responde al dedo, Puente
     cambia de plano, Revelar trae contenido contextual, Trazar dibuja un
     resultado y Pulso acompaña una espera.

     \`trace\` es nueva y es la única que puede pasar de Revelar sin estar
     procesando: dibujar un diagrama de momento es la explicación de un
     resultado, y verlo aparecer de golpe no explica nada. */
  --sc-motion-instant: 90ms;
  --sc-motion-quick: 140ms;
  --sc-motion-bridge: 200ms;
  --sc-motion-reveal: 280ms;
  --sc-motion-trace: 520ms;
  --sc-motion-pulse: 1400ms;

  --sc-motion-press: 90ms;
  --sc-motion-fast: var(--sc-motion-quick);
  --sc-motion-control: var(--sc-motion-quick);
  --sc-motion-standard: var(--sc-motion-bridge);
  --sc-motion-slow: var(--sc-motion-reveal);
  --sc-motion-loading: var(--sc-motion-pulse);
  --sc-motion-morph-duration: var(--sc-motion-bridge);
  --sc-motion-distance-factor: 0.5;
  --sc-motion-dock-scale: 1;

  /* EJE AMBIENTAL, separado de la escala anterior a propósito.

     La regla del brandbook es un trabajo por duración, y los seis trabajos son
     respuestas: acusar recibo, responder al dedo, cambiar de plano, traer
     contenido, dibujar un resultado, acompañar una espera. Un bucle decorativo
     e infinito no responde a nada, así que no tiene ninguno de esos seis
     trabajos y no puede tomar prestado su escalón: forzar una respiración de
     cinco píxeles a 1400 ms la convertiría en el paseo que el diseño de la
     bienvenida evita a propósito encima de un botón.

     Por eso se declara aparte y se nombra, en vez de esconder un literal en una
     hoja de feature. La frontera no es sólo este comentario: \`designSystem\`
     comprueba que estos tokens sólo aparezcan en una \`animation\` infinita, para
     que el eje ambiental no se convierta en una séptima duración de
     interacción por la puerta de atrás. */
  --sc-motion-ambient-loop: 7000ms;
  --sc-motion-ambient-delay: 1100ms;

  /* Las tres curvas del brandbook. \`standard\` sale rápido y frena largo, para
     que lo que aparece se lea como una consecuencia y no como un salto;
     \`exit\` acelera al irse, porque lo que se va no necesita ser leído; \`firm\`
     es simétrica y es la de un cambio que el sistema decide, no el dedo. */
  --sc-ease-standard: cubic-bezier(.2, .8, .2, 1);
  --sc-ease-reveal: var(--sc-ease-standard);
  --sc-ease-enter: var(--sc-ease-standard);
  --sc-ease-exit: cubic-bezier(.5, 0, .75, 0);
  --sc-ease-firm: cubic-bezier(.65, 0, .35, 1);
  --sc-ease-press: var(--sc-ease-standard);
  --sc-ease-emphasized: var(--sc-ease-firm);
  --sc-spring-soft: var(--sc-ease-standard);
  --sc-spring-panel: var(--sc-ease-standard);

  --sc-transition-control:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    border-color var(--sc-motion-control) var(--sc-ease-standard),
    color var(--sc-motion-control) var(--sc-ease-standard),
    opacity var(--sc-motion-control) var(--sc-ease-standard);
  --sc-transition-control-no-transform: var(--sc-transition-control);
  --sc-transition-theme:
    background-color var(--sc-motion-standard) var(--sc-ease-standard),
    border-color var(--sc-motion-standard) var(--sc-ease-standard),
    color var(--sc-motion-standard) var(--sc-ease-standard);

  --sc-z-base: 0;
  --sc-z-sticky: 10;
  --sc-z-panel: 20;
  --sc-z-topbar: 30;
  --sc-z-drawer: 40;
  --sc-z-sheet: 50;
  --sc-z-popover: 60;
  --sc-z-modal: 70;
  --sc-z-toast: 80;

  /* ------------------------------------------------------------------ */
  /* 9 · ALIAS DE COMPATIBILIDAD                                         */
  /* ------------------------------------------------------------------ */
  /* El CSS heredado de ambos productos nombra estos alias cortos. Ninguno
     declara un valor propio: todos resuelven a un rol de arriba, así que el
     tema oscuro los arrastra sin repetir una sola línea. */
  --app-bg: var(--sc-color-bg-app);
  --canvas-bg: var(--sc-color-bg-canvas);
  --surface: var(--sc-color-surface-1);
  --surface-1: var(--sc-color-surface-1);
  --surface-raised: var(--sc-color-surface-1);
  --surface-2: var(--sc-color-surface-2);
  --surface-3: var(--sc-color-surface-3);
  --text: var(--sc-color-text-primary);
  --muted: var(--sc-color-text-secondary);
  --muted-strong: var(--sc-color-text-technical);
  --subtle: var(--sc-color-text-muted);
  --text-muted: var(--sc-color-text-muted);
  --border: var(--sc-color-border);
  --border-soft: var(--sc-color-border-soft);
  --line: var(--sc-color-divider);
  --shadow: var(--sc-shadow-lg);
  --shadow-lg: var(--sc-shadow-lg);

  --accent: var(--sc-color-action-primary);
  --accent-fill: var(--sc-color-action-primary);
  --accent-hover: var(--sc-color-action-hover);
  --accent-pressed: var(--sc-color-action-pressed);
  --accent-soft: var(--sc-color-action-subtle);
  --accent-on-soft: var(--sc-color-action-ink-on-soft);
  --accent-foreground: var(--sc-color-action-foreground);
  --accent-edge: var(--sc-color-action-edge);
  --accent-ink: var(--sc-color-action-ink);
  --brand-secondary: var(--sc-color-brand-secondary);

  --focus: var(--sc-color-focus);
  --selection: var(--sc-color-selection-stroke);
  --selection-soft: var(--sc-color-selection);
  --grid: var(--sc-color-canvas-grid);
  --grid-strong: var(--sc-color-canvas-grid-strong);
  --member: var(--sc-color-canvas-member);
  --node-fill: var(--sc-color-canvas-node-fill);

  --force: var(--sc-color-technical-load);
  --axial: var(--sc-color-technical-axial);
  --shear: var(--sc-color-technical-shear);
  --moment: var(--sc-color-technical-moment);
  --deformed: var(--sc-color-technical-deformed);
  --yield: var(--sc-color-technical-yield);
  --reaction: var(--sc-color-technical-reaction);
  --dimension: var(--sc-color-technical-dimension);
  --axis: var(--sc-color-technical-axis);

  /* Tinta de señal, en alias corto: lo que usa una leyenda, una cifra con
     unidad o el nombre de un diagrama. */
  --axial-ink: var(--sc-color-signal-axial-ink);
  --shear-ink: var(--sc-color-signal-shear-ink);
  --moment-ink: var(--sc-color-signal-moment-ink);
  --force-ink: var(--sc-color-signal-action-ink);
  --deformed-ink: var(--sc-color-signal-deformed-ink);
  --alert-ink: var(--sc-color-signal-alert-ink);

  --success: var(--sc-color-state-success);
  --success-solid: var(--sc-color-success-solid);
  --success-foreground: var(--sc-color-state-success-foreground);
  --warning: var(--sc-color-state-warning);
  --error: var(--sc-color-state-error);
  --error-solid: var(--sc-color-error-solid);
  --error-foreground: var(--sc-color-state-error-foreground);
  --danger: var(--sc-color-state-error);

  --radius-sm: var(--sc-radius-control);
  --radius-md: var(--sc-radius-card);
  --radius-lg: var(--sc-radius-panel);

  --motion-press: var(--sc-motion-press);
  --motion-fast: var(--sc-motion-fast);
  --motion-control: var(--sc-motion-control);
  --motion-standard: var(--sc-motion-standard);
  --motion-slow: var(--sc-motion-slow);
  --motion-loading: var(--sc-motion-loading);
  --ease-native: var(--sc-ease-standard);
  --ease-enter: var(--sc-ease-enter);
  --ease-exit: var(--sc-ease-exit);
  --ease-press: var(--sc-ease-press);

  --topbar-h: var(--sc-layout-topbar);
  --toolbar-w: var(--sc-layout-rail);
  --inspector-w: var(--sc-layout-inspector);
}

/* ==================================================================== */
/* 10 · TEMA NOCHE                                                       */
/* ==================================================================== */
/* Sólo neutros y tintas de estado. Ni un hue del dominio se repite aquí: el
   bloque es corto a propósito, y que lo sea es la prueba de que la identidad
   vive en \`:root\`. */
:root[data-theme='dark'] {
  color-scheme: dark;

  /* CARBÓN. Valores literales de la rampa Noche del brandbook web. */
  --sc-color-bg-app: #14171a;
  --sc-color-bg-canvas: #0e1113;
  --sc-color-surface-1: #1b1f22;
  --sc-color-surface-2: #0e1113;
  --sc-color-surface-3: #252a2e;
  --sc-color-surface-elevated: #1b1f22;
  --sc-color-surface-floating: #252a2e;
  --sc-color-surface-inset: #0e1113;
  --sc-color-surface-pressed: #333a3e;
  --sc-color-surface-toolbar: #1b1f22;
  --sc-color-surface-input: #0e1113;

  --sc-color-fill-primary: #333a3e;
  --sc-color-fill-secondary: #252a2e;
  --sc-color-fill-tertiary: #1b1f22;
  --sc-color-fill-quaternary: #1b1f22;

  --sc-color-text-primary: #f2f4f3;
  --sc-color-text-secondary: #8b9599;
  --sc-color-text-muted: #5e6a6f;
  --sc-color-text-tertiary: #5e6a6f;
  --sc-color-text-subtle: #465055;
  --sc-color-text-technical: #b4bdc0;
  --sc-color-text-unit: #8b9599;
  --sc-color-text-disabled: #5e6a6f;
  --sc-color-text-disabled-content: #8b9599;
  --sc-color-text-inverse: #0e1113;
  --sc-color-text-on-action: #0e1113;
  --sc-color-text-link: #f2f4f3;

  --sc-color-border-soft: #252a2e;
  --sc-color-border: #333a3e;
  --sc-color-border-strong: #465055;
  --sc-color-divider: #252a2e;
  --sc-color-border-canvas-chrome: #465055;

  /* El salmón se recalibra sobre carbón; la geometría no cambia. */
  --sc-color-action-primary: var(--fs-family-analisis);
  --sc-color-action-hover: color-mix(in srgb, var(--fs-family-analisis) 88%, var(--sc-color-text-primary));
  --sc-color-action-pressed: color-mix(in srgb, var(--fs-family-analisis) 78%, var(--sc-color-bg-canvas));
  --sc-color-action-foreground: #14171a;
  --sc-color-action-edge: var(--fs-family-analisis);
  --sc-color-action-ink: var(--fs-family-analisis);
  --sc-color-action-ink-on-soft: var(--fs-family-analisis);
  --sc-color-action-subtle: #1b1f22;
  --sc-color-brand: var(--fs-family-analisis);
  --sc-color-brand-secondary: #8b9599;
  --sc-color-accent-blue-soft: #1b1f22;
  --sc-color-accent-violet-soft: #1b1f22;

  --sc-color-focus: var(--fs-family-analisis);
  --sc-color-selection: #333a3e;
  --sc-color-selection-stroke: #f2f4f3;
  --sc-color-selection-outline: #f2f4f3;

  /* LAS SEIS SEÑALES EN NOCHE, y la familia pastel de las cargas.
     Se recalibra la SEÑAL, no una tinta aparte: desde la adopción del par
     Día/Noche del brandbook la señal y su tinta son la misma variable, así que
     todo lo que cuelga de ellas —trazo del diagrama, cifra de la leyenda,
     icono de la herramienta— se recalibra de una vez y no puede
     descuadrarse. */
  --fs-signal-axial: #63c5ff;
  --fs-signal-moment: #ff8e80;
  --fs-signal-shear: #55c990;
  --fs-signal-deformed: #a990ff;
  --fs-signal-yield: #ef7ab9;
  --fs-signal-attention: #f3c553;
  --fs-brand-register: #1aa57a;

  /* Sobre carbón la carga sube de luminosidad sin perder croma: el mismo
     cobalto, bermellón y esmeralda, recalibrados para que sigan separados de
     la señal de su tono, que en Noche también es más clara. */
  --fs-load-point: #2f92ff;
  --fs-load-distributed: #ff6f3c;
  --fs-load-moment: #1ddfae;

  /* Las familias conservan arquitectura y se recalibran sobre carbón. */
  --fs-family-nucleo: #1aa57a;
  --fs-family-analisis: #ff8e80;
  --fs-family-modelo: #a990ff;
  --fs-family-civil: #72cf4a;
  --fs-family-proyecto: #f3c553;
  --fs-family-interop: #72a1ff;
  --fs-family-aprendizaje: #f07db5;
  --fs-status-disponible: #55c990;
  --fs-status-experimental: #f3c553;
  --fs-status-planeado: #8b9599;
  --fs-status-no-comprometido: #5e6a6f;

  --sc-color-state-success-foreground: #55c990;
  --sc-color-state-warning-foreground: #f3c553;
  --sc-color-state-error-foreground: #ff6f66;
  --sc-color-state-critical: #ff6f66;
  --sc-color-state-loading: #8d8f8c;
  --sc-color-state-pending: #8d8f8c;

  --sc-color-canario-ink: #141719;

  --sc-color-canvas-grid: #212528;
  --sc-color-canvas-grid-strong: #2d3336;
  --sc-color-canvas-member: #f2f4f3;
  --sc-color-canvas-node-fill: #0e1113;
  --sc-color-overlay-soft: rgb(8 10 11 / .46);
  --sc-color-overlay-sheet: rgb(8 10 11 / .58);
  --sc-color-overlay-strong: rgb(8 10 11 / .70);

  --sc-color-illustration-ivory: #22262a;
  --sc-color-illustration-ivory-deep: #1c2023;
  --sc-color-illustration-lime: #d3d4d0;
  --sc-color-illustration-lime-deep: #f4f4f1;

  /* La estructura en reposo sigue siendo tinta: ahora la tinta es clara. */
  --sc-color-structure-spring: #8d8f8c;
  --sc-color-structure-hinge: #8d8f8c;
  --sc-color-structure-release: #8d8f8c;
  --sc-color-technical-axis: #5f6669;
  --sc-color-technical-dimension: #f3c553;
  --sc-color-critical-point: #f3c553;
  --sc-color-stale-result: #f3c553;
  --sc-color-snap-target: #f2f4f3;
  --sc-color-hover-target: #f2f4f3;
  --sc-color-envelope: #8d8f8c;
  --sc-color-demand-base: #1668b0;
  --sc-color-demand-peak: #a8d5f4;
  --sc-color-demand-unevaluated: #5f6669;

  /* Las tres áreas traslúcidas llevan el hex literal de su tono porque
     \`rgb()\` no acepta una variable en sus canales. Al recalibrarse la señal,
     tienen que recalibrarse con ella o el relleno deja de pertenecer a su
     línea. */
  --sc-color-technical-distributed-area: color-mix(in srgb, var(--fs-load-distributed) 14%, transparent);
  --sc-color-technical-shear-area: rgb(85 201 144 / .14);
  --sc-color-influence-area: rgb(239 122 185 / .14);

  /* El corte es el único rol de herramienta que no cuelga de una señal ni de
     una carga: es tinta de chrome, y el gris tiene que cambiar de lado. */
  --sc-color-tool-cut: #a7a9a6;

  /* La geometría de la arcilla no cambia; sólo cambian sus materiales. */
  --sc-clay-light: rgb(255 255 255 / 16%);
  --sc-clay-dark: rgb(0 0 0 / 55%);
  --sc-clay-dark-soft: rgb(0 0 0 / 35%);
  --sc-clay-dark-strong: rgb(0 0 0 / 70%);
  --sc-clay-veil: rgb(0 0 0 / 62%);
}
`)?.[0]??``}\nsvg {\n${(/\.design-workbench\s*\{([\s\S]*?)\}/.exec(`/*
 * Diseño de elementos. Mismo lenguaje que el Modelo 2D: un lienzo hundido con
 * cuadrícula en el centro, controles flotantes con la misma luz y paneles
 * planos a los lados. Los colores de dominio sólo trazan resultados.
 */
.design-workbench {
  --dw-ink: var(--sc-color-text-primary);
  --dw-muted: var(--sc-color-text-secondary);
  --dw-subtle: var(--sc-color-text-tertiary, var(--sc-color-text-secondary));
  --dw-line: var(--sc-color-border-soft, var(--sc-color-border));
  --dw-pass: var(--sc-color-state-success);
  --dw-fail: var(--sc-color-state-error);
  --dw-warn: var(--sc-color-state-warning);
  --dw-moment: var(--sc-color-technical-moment);
  --dw-shear: var(--sc-color-technical-shear);
  --dw-axial: var(--sc-color-technical-axial);
  --dw-deformed: var(--sc-color-technical-deformed);
  --dw-steel: var(--sc-color-text-primary);
  --dw-bastion: var(--sc-color-action-primary);
  position: absolute;
  inset: 0;
  display: flex;
  min-height: 0;
  overflow: hidden;
  color: var(--dw-ink);
  font-family: var(--sc-font-ui);
  font-size: var(--sc-font-size-body);
}

.dw-input-note { margin: 4px 0 12px; color: var(--dw-muted); font-size: 11px; line-height: 1.6; }
.dw-action-feedback { position: absolute; z-index: 30; top: 10px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; width: max-content; max-width: calc(100% - 24px); margin: 0; padding: 10px 12px; border: 1px solid var(--dw-line); border-left: 3px solid var(--fs-signal-attention); border-radius: var(--sc-radius-card); background: var(--sc-color-surface-1); box-shadow: var(--sc-shadow-md); font-size: 12px; line-height: 1.5; }
.dw-action-feedback button { flex: none; min-width: 44px; min-height: 44px; border: 0; border-radius: var(--sc-radius-control); background: var(--sc-color-surface-2); color: var(--dw-ink); font-size: 20px; cursor: pointer; }
.dw-review-inputs { position: absolute; z-index: 3; bottom: 130px; left: var(--dw-left); right: var(--dw-right); display: grid; justify-items: center; gap: 8px; padding: 10px; text-align: center; }
.dw-review-inputs button { min-height: 44px; padding: 10px 18px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-control); background: var(--sc-color-surface-1); color: var(--dw-ink); box-shadow: var(--sc-shadow-xs); cursor: pointer; }
.dw-review-inputs span { color: var(--dw-muted); font-size: 12px; line-height: 1.5; }
.dw-eyebrow {
  margin: 0;
  color: var(--dw-muted);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .07em;
  text-transform: uppercase;
}

/* ─── Mesa: el lienzo ocupa todo; datos y resultados flotan encima ─── */
.dw-layout {
  --dw-panel-inputs: 304px;
  --dw-panel-results: 320px;
  --dw-edge: 12px;
  --dw-left: var(--dw-edge);
  --dw-right: var(--dw-edge);
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  padding: 8px;
}
.dw-layout[data-inputs='open'] { --dw-left: calc(var(--dw-panel-inputs) + 2 * var(--dw-edge)); }
.dw-layout[data-results='open'] { --dw-right: calc(var(--dw-panel-results) + 2 * var(--dw-edge)); }

/* ─── Lienzo: igual al del Modelo 2D ─── */
.dw-stage {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-radius: var(--sc-radius-card);
  background-color: var(--sc-color-bg-canvas);
  background-image:
    linear-gradient(var(--sc-color-canvas-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--sc-color-canvas-grid) 1px, transparent 1px);
  background-size: 48px 48px;
  box-shadow: var(--sc-shadow-inset);
  overflow: hidden;
}
.dw-stage__scroll {
  position: absolute;
  inset: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 64px calc(var(--dw-right) + 16px) 160px calc(var(--dw-left) + 16px);
  scrollbar-width: thin;
  transition: padding var(--sc-motion-bridge) var(--sc-ease-standard);
}
.dw-stage__content {
  --z: var(--dw-zoom, 1);
  width: calc(100% * var(--z));
  margin-inline: auto;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: safe center;
  gap: calc(12px * var(--z)) calc(32px * var(--z));
  padding-bottom: 40px;
}

/* Chips sobre el lienzo: veredicto a la izquierda, norma a la derecha. */
.dw-hud { position: absolute; top: 12px; z-index: 2; display: flex; gap: 6px; min-width: 0; transition: left var(--sc-motion-bridge) var(--sc-ease-standard), right var(--sc-motion-bridge) var(--sc-ease-standard); }
.dw-hud--start { left: var(--dw-left); max-width: calc(100% - var(--dw-left) - var(--dw-right) - 150px); }
.dw-hud--end { right: var(--dw-right); }

.dw-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--sc-radius-card);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-raised);
  color: var(--dw-ink);
  font: 600 12px/1 var(--sc-font-ui);
  white-space: nowrap;
}
.dw-badge i { flex: none; width: 8px; height: 8px; border-radius: var(--sc-radius-pill); background: var(--status); }
.dw-badge[data-status] { --status: var(--dw-pass); color: var(--status); }
.dw-badge[data-status='fail'], .dw-badge[data-status='error'] { --status: var(--dw-fail); }
.dw-badge[data-status='warning'] { --status: var(--dw-warn); }
.dw-badge--button {
  cursor: pointer;
  transition:
    box-shadow var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-badge--button:disabled { cursor: default; }
.dw-badge--button:hover:not(:disabled) {
  box-shadow: var(--sc-shadow-lifted);
  transform: translateY(-1px);
}
.dw-badge--button:active:not(:disabled) {
  transform: var(--sc-press-transform);
  box-shadow: var(--sc-shadow-inset);
}
.dw-badge--caption { overflow: hidden; text-overflow: ellipsis; color: var(--dw-muted); font-weight: 500; }

.dw-code-chip { position: relative; display: inline-flex; align-items: center; }
.dw-code-chip select {
  appearance: none;
  min-height: 34px;
  padding: 0 30px 0 12px;
  border: 0;
  border-radius: var(--sc-radius-card);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-raised);
  color: var(--dw-ink);
  font: 600 12px/1 var(--sc-font-ui);
  cursor: pointer;
}
.dw-code-chip svg { position: absolute; right: 10px; color: var(--dw-muted); pointer-events: none; }

.dw-badge--button:focus-visible, .dw-code-chip select:focus-visible, .dw-zoom button:focus-visible,
.dw-icon-button:focus-visible, .dw-add:focus-visible, .dw-more__toggle:focus-visible {
  outline: var(--sc-focus-ring-width) solid var(--sc-color-focus);
  outline-offset: 2px;
}

/* Zoom del lienzo: la misma pieza que en el Modelo 2D. */
.dw-zoom {
  position: absolute;
  right: var(--dw-right);
  bottom: 16px;
  z-index: 2;
  display: flex;
  padding: 3px;
  border-radius: var(--sc-radius-card);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-raised);
  transition: right var(--sc-motion-bridge) var(--sc-ease-standard);
}
.dw-zoom button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 32px;
  border: 0;
  border-radius: var(--sc-radius-control);
  background: transparent;
  color: var(--dw-muted);
  cursor: pointer;
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    color var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-zoom button:hover:not(:disabled) {
  color: var(--dw-ink);
  background: var(--sc-color-fill-quaternary);
  transform: translateY(-1px);
}
.dw-zoom button:active:not(:disabled) {
  transform: var(--sc-press-transform);
}
.dw-zoom button:disabled { opacity: .35; cursor: default; }

/* Barra flotante inferior: elementos y vistas, como la barra de herramientas 2D. */
.dw-dock {
  position: absolute;
  left: calc(var(--dw-left) + 8px);
  right: calc(var(--dw-right) + 8px);
  bottom: 22px;
  z-index: 5;
  width: max-content;
  max-width: calc(100% - var(--dw-left) - var(--dw-right) - 16px);
  margin-inline: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 6px;
  border-radius: var(--sc-radius-panel);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-lifted);
  overflow-x: auto;
  scrollbar-width: none;
  transition: left var(--sc-motion-bridge) var(--sc-ease-standard), right var(--sc-motion-bridge) var(--sc-ease-standard);
}
.dw-dock__group { display: flex; gap: 4px; }
.dw-dock__divider { flex: none; width: 1px; height: 24px; margin: 0 4px; background: var(--dw-line); }
.dw-dock .sc-tool-button {
  flex: none;
  width: auto;
  min-height: 38px;
  padding: 0 12px 0 8px;
  grid-template-columns: auto auto;
  border-radius: var(--sc-radius-control);
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    box-shadow var(--sc-motion-control) var(--sc-ease-standard),
    color var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-dock .sc-tool-button:hover:not(:disabled) {
  transform: translateY(-1px);
}
.dw-dock .sc-tool-button:active:not(:disabled) {
  transform: var(--sc-press-transform);
  box-shadow: var(--sc-shadow-inset);
}
.dw-dock .sc-tool-button:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }
.dw-element-icon { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linejoin: round; stroke-linecap: round; }

/* Vistas: en escritorio, dos interruptores de panel; en móvil, pestañas. */
.dw-views { display: flex; gap: 4px; }
.dw-view {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 38px;
  min-height: 38px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--sc-radius-control);
  background: transparent;
  color: var(--dw-muted);
  font: 600 12px/1 var(--sc-font-ui);
  cursor: pointer;
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    box-shadow var(--sc-motion-control) var(--sc-ease-standard),
    color var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-view:hover:not(:disabled) {
  color: var(--dw-ink);
  background: var(--sc-color-surface-2);
  transform: translateY(-1px);
}
.dw-view:active:not(:disabled) {
  transform: var(--sc-press-transform);
  box-shadow: var(--sc-shadow-inset);
}
.dw-view[aria-pressed='true'] { color: var(--sc-color-action-primary); background: var(--sc-color-surface-2); }
.dw-view:disabled { opacity: .4; cursor: default; }
.dw-view:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }
.dw-view > span, .dw-view > em, .dw-view--stage { display: none; }
.dw-view > em { --status: var(--dw-pass); align-items: center; gap: 4px; color: var(--status); font: 600 11px/1 var(--sc-font-mono); font-style: normal; }
.dw-view > em i { width: 7px; height: 7px; border-radius: var(--sc-radius-pill); background: var(--status); }
.dw-view[data-status='fail'] > em { --status: var(--dw-fail); }
.dw-view[data-status='warning'] > em { --status: var(--dw-warn); }

/* Láminas: dibujo directo sobre el lienzo, sin marco. Todo escala con el zoom. */
.dw-plate { flex: 1 1 calc(300px * var(--z)); max-width: calc(440px * var(--z)); min-width: 0; margin: 0; }
.dw-plate--wide { flex: 1 1 100%; max-width: calc(980px * var(--z)); }
.dw-plate figcaption { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 0 0 8px; }
.dw-plate figcaption small { color: var(--dw-subtle); font-size: 11px; }

/* ─── Paneles flotantes ─── */
.dw-panel {
  position: absolute;
  top: calc(8px + var(--dw-edge));
  bottom: calc(8px + var(--dw-edge));
  z-index: 4;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: var(--sc-radius-panel);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-lifted);
  transition:
    transform var(--sc-motion-bridge) var(--sc-ease-standard),
    opacity var(--sc-motion-bridge) var(--sc-ease-standard),
    visibility 0s linear 0s;
}
.dw-inputs { left: calc(8px + var(--dw-edge)); width: var(--dw-panel-inputs); }
.dw-results { right: calc(8px + var(--dw-edge)); width: var(--dw-panel-results); }
.dw-panel[data-open='false'] {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transition:
    transform var(--sc-motion-bridge) var(--sc-ease-standard),
    opacity var(--sc-motion-bridge) var(--sc-ease-standard),
    visibility 0s linear var(--sc-motion-bridge);
}
.dw-inputs[data-open='false'] { transform: translateX(-16px); }
.dw-results[data-open='false'] { transform: translateX(16px); }
.dw-panel__head { flex: none; display: flex; align-items: center; gap: 2px; padding: 12px 10px 8px 16px; }
.dw-panel__head h2 { flex: 1; min-width: 0; margin: 0; font: 600 var(--sc-font-size-display-md)/1.15 var(--sc-font-display); }
.dw-panel__body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; padding: 0 14px 20px; }
.dw-results .dw-panel__body { display: flex; flex-direction: column; }

/* ─── Formulario ─── */
.dw-hook { stroke: var(--dw-steel); stroke-width: 2.6; stroke-linecap: round; fill: none; }
.dw-hook.is-fail { stroke: var(--dw-fail); }
.dw-icon-button {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--sc-radius-control);
  background: transparent;
  color: var(--dw-muted);
  cursor: pointer;
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    color var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-icon-button:hover:not(:disabled) {
  color: var(--dw-ink);
  background: var(--sc-color-fill-quaternary);
  transform: translateY(-1px);
}
.dw-icon-button:active:not(:disabled) {
  transform: var(--sc-press-transform);
}
.dw-icon-button:disabled { opacity: .35; cursor: default; }

.dw-group { padding: 14px 2px 12px; border-top: 1px solid var(--dw-line); min-width: 0; }
.dw-panel__body > .dw-group:first-child { border-top: 0; padding-top: 4px; }
.dw-group > header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.dw-group__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.dw-group__grid[data-columns='1'] { grid-template-columns: minmax(0, 1fr); }
.dw-group__grid[data-columns='3'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.dw-span-all { grid-column: 1 / -1; }
.dw-group .sc-segmented { width: 100%; }
.dw-end { display: grid; grid-template-columns: 58px minmax(0, 1fr); align-items: center; gap: 8px; }
.dw-end > span { color: var(--dw-muted); font-size: 11.5px; }
.dw-group .sc-segmented button { flex: 1; padding-inline: 4px; }
.dw-group .sc-unit-field__control input { min-width: 0; }

.dw-more { padding-top: 6px; }
.dw-more__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 0;
  border: 0;
  background: none;
  color: var(--dw-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dw-more__toggle:hover { color: var(--dw-ink); }
.dw-more__toggle svg { transition: transform var(--sc-motion-quick) var(--sc-ease-standard); }
.dw-more__toggle[aria-expanded='true'] svg { transform: rotate(180deg); }
.dw-more__toggle[aria-expanded='true'] { margin-bottom: 8px; }
.dw-results .dw-more { border-top: 1px solid var(--dw-line); }
.dw-more__body > * + * { margin-top: 14px; }

/* Tabla de claros */
.dw-spans { --cols: 3; display: grid; gap: 6px; }
.dw-spans__row--sub { margin-top: -2px; }
.dw-spans__row--sub input { height: 28px; background: var(--sc-color-surface-1); }
.dw-spans__head--sub { margin-top: 2px; }
.dw-spans__row { display: grid; grid-template-columns: 18px repeat(var(--cols), minmax(0, 1fr)) 30px; gap: 5px; align-items: center; }
.dw-spans__head span { color: var(--dw-muted); font-size: 11px; font-weight: 600; text-align: center; line-height: 1.1; }
.dw-spans__head small { display: block; color: var(--dw-subtle); font-weight: 400; font-size: 9.5px; }
.dw-spans__index { color: var(--dw-subtle); font: 500 11px var(--sc-font-mono); text-align: center; }
.dw-spans input {
  width: 100%;
  min-width: 0;
  height: var(--sc-control-height-sm, 32px);
  padding: 0 7px;
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-data);
  background: var(--sc-color-surface-input);
  box-shadow: var(--sc-shadow-inset);
  color: var(--dw-ink);
  font: 500 12px var(--sc-font-mono);
  text-align: right;
}
.dw-spans input:focus { outline: none; border-color: var(--sc-color-action-primary); }
.dw-spans input[aria-invalid='true'] { border-color: var(--sc-color-state-error); }
.dw-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  margin-top: 2px;
  border: 1px dashed var(--sc-color-border);
  border-radius: var(--sc-radius-data);
  background: transparent;
  color: var(--dw-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dw-add:hover { color: var(--dw-ink); border-color: var(--dw-muted); }

/* ─── Dibujos ─── */
.dw-drawing { display: block; width: 100%; height: auto; overflow: visible; font-family: var(--sc-font-mono); font-size: 11px; }
.dw-drawing--section { max-width: calc(250px * var(--z, 1)); margin-inline: auto; }
.dw-drawing--plan { max-width: calc(340px * var(--z, 1)); margin-inline: auto; }
.dw-chart { max-width: calc(600px * var(--z, 1)); margin-inline: auto; }
.dw-drawing text { fill: var(--dw-ink); }
.dw-drawing .dw-muted { fill: var(--dw-muted); }

.dw-beam, .dw-concrete { fill: var(--sc-color-surface-1); stroke: var(--dw-ink); stroke-width: 1.3; }
.dw-column { fill: var(--sc-color-surface-3, var(--sc-color-surface-2)); stroke: var(--dw-ink); stroke-width: 1.3; }
.dw-pedestal { fill: var(--sc-color-surface-2); stroke: var(--dw-ink); stroke-width: 1.3; }
.dw-rebar { stroke: var(--dw-steel); stroke-width: 2.6; stroke-linecap: round; }
.dw-stirrup-tick { stroke: var(--dw-muted); stroke-width: .9; }
.dw-zone { fill: var(--dw-shear); opacity: .8; }
.dw-stirrup { fill: none; stroke: var(--dw-muted); }
.dw-bar { fill: var(--dw-steel); }
.dw-bar--extra { fill: var(--dw-bastion); }
.dw-bastion line:first-child, .dw-bastion path { stroke: var(--dw-bastion); stroke-width: 2.6; stroke-linecap: round; fill: none; }
.dw-bastion text { fill: var(--dw-bastion) !important; font-family: var(--sc-font-ui); font-weight: 600; font-size: 11px; }
.dw-bastion__leader { stroke: var(--dw-bastion); stroke-width: .8 !important; stroke-dasharray: 2 2; opacity: .7; }
.dw-rebar-label { font-family: var(--sc-font-ui); font-weight: 600; font-size: 11px; }
.dw-stirrup-label { fill: var(--dw-muted) !important; font-size: 10.5px; }
.dw-rebar-grid line { stroke: var(--dw-muted); stroke-width: .8; opacity: .6; }
.dw-critical { fill: none; stroke: var(--dw-shear); stroke-width: 1.5; stroke-dasharray: 6 4; }
.dw-critical--oneway { stroke-dasharray: 2 3; }
.dw-property-line { stroke: var(--dw-ink); stroke-width: 2.5; stroke-dasharray: 10 4 2 4; }

.dw-load line { stroke: var(--sc-color-load-distributed, var(--dw-ink)); stroke-width: 1.2; }
.dw-load__head { fill: var(--sc-color-load-distributed, var(--dw-ink)); }
.dw-load text { font-size: 11px; fill: var(--sc-color-load-distributed, var(--dw-ink)) !important; }
.dw-load--point line { stroke-width: 2; }
.dw-support path { fill: var(--sc-color-surface-1); stroke: var(--dw-ink); stroke-width: 1.3; }
.dw-support line { stroke: var(--dw-ink); stroke-width: 1.8; }
.dw-support .dw-support__hatch { stroke-width: 1; }
.dw-dimension line { stroke: var(--sc-color-technical-dimension, var(--dw-muted)); stroke-width: 1; }
.dw-dimension text { fill: var(--dw-muted); font-size: 10.5px; }
.dw-callout { font-family: var(--sc-font-ui); font-weight: 600; font-size: 11.5px; }
.dw-axis line { stroke: var(--dw-muted); stroke-width: .8; stroke-dasharray: 5 3 1 3; }
.dw-axis text { fill: var(--dw-muted); font-size: 10px; font-weight: 600; }
.dw-soil line { stroke: var(--dw-axial); stroke-width: 1.2; }
.dw-soil__head { fill: var(--dw-axial); }
.dw-soil text { fill: var(--dw-muted); font-size: 10.5px; }

/* Las bandas de diagrama (\`fs-band\`) y el cursor de lectura (\`fs-probe\`) son
   comunes: \`src/design-system/components/diagramBands.css\`. */

.dw-chart__grid line { stroke: var(--sc-color-canvas-grid-strong, var(--dw-line)); stroke-width: .8; }
.dw-chart__grid text { fill: var(--dw-muted); font-size: 10px; }
.dw-chart__zero { stroke: var(--dw-ink); stroke-width: 1; opacity: .7; }
.dw-chart__title { font-family: var(--sc-font-ui); font-size: 11px; fill: var(--dw-muted) !important; }
.dw-curve { fill: none; stroke-linejoin: round; }
.dw-curve--x { stroke: var(--dw-axial); stroke-width: 2.2; }
.dw-curve--y { stroke: var(--dw-deformed); stroke-width: 2.2; stroke-dasharray: 8 4; }
.dw-curve--nominal { stroke: var(--dw-muted); stroke-width: 1.1; stroke-dasharray: 2 3; }
.dw-chart__cap line { stroke: var(--dw-axial); stroke-width: 1; stroke-dasharray: 4 3; }
.dw-chart__cap text { fill: var(--dw-axial) !important; font-size: 10px; }
.dw-chart__balanced { fill: var(--sc-color-bg-canvas); stroke: var(--dw-axial); stroke-width: 1.5; }
.dw-demand line { stroke: var(--dw-moment); stroke-width: 1; stroke-dasharray: 3 3; }
.dw-demand circle { fill: var(--dw-moment); stroke: var(--sc-color-bg-canvas); stroke-width: 2; }
.dw-demand text { font-family: var(--sc-font-ui); font-weight: 600; fill: var(--dw-moment) !important; }

.dw-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; margin: 6px 0 0; padding: 0; list-style: none; color: var(--dw-muted); font-size: 11px; }
.dw-legend li { display: flex; align-items: center; gap: 6px; }
.dw-legend li::before { content: ''; width: 18px; height: 0; border-top: 2.2px solid var(--dw-axial); }
.dw-legend li[data-kind='y']::before { border-top-color: var(--dw-deformed); border-top-style: dashed; }
.dw-legend li[data-kind='nominal']::before { border-top: 1.4px dotted var(--dw-muted); }
.dw-legend li[data-kind='demand']::before { width: 9px; height: 9px; border: 0; border-radius: var(--sc-radius-pill); background: var(--dw-moment); }

/* ─── Resultados: planos, separados por filetes ─── */
.dw-verdict { --status: var(--dw-pass); padding: 4px 2px 16px; }
.dw-verdict[data-status='fail'] { --status: var(--dw-fail); }
.dw-verdict[data-status='warning'] { --status: var(--dw-warn); }
.dw-verdict__head { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.dw-verdict__head > svg { flex: none; color: var(--status); }
.dw-verdict__head strong { font: 600 var(--sc-font-size-display-md)/1.15 var(--sc-font-display); }
.dw-verdict__percent { margin-left: auto; font: 600 24px/1 var(--sc-font-mono); color: var(--status); }
.dw-verdict__percent small { font-size: 12px; margin-left: 1px; }
.dw-verdict__scope { display: flex; align-items: flex-start; gap: 6px; margin: 10px 0 0; color: var(--dw-muted); font-size: 11.5px; line-height: 1.4; }
.dw-verdict__scope > svg { flex: none; margin-top: 2px; }

.dw-meter { position: relative; height: 5px; margin-top: 12px; border-radius: var(--sc-radius-pill); background: var(--sc-color-surface-inset); overflow: hidden; }
.dw-meter i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--status, var(--dw-pass)); transition: width var(--sc-motion-bridge) var(--sc-ease-standard); }
.dw-meter--thin { height: 3px; margin-top: 4px; }

.dw-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; margin: 14px 0 0; }
.dw-summary div { min-width: 0; padding-left: 8px; border-left: 2px solid var(--dw-line); }
.dw-summary div[data-tone='moment'] { border-left-color: var(--dw-moment); }
.dw-summary div[data-tone='shear'] { border-left-color: var(--dw-shear); }
.dw-summary div[data-tone='axial'] { border-left-color: var(--dw-axial); }
.dw-summary dt { color: var(--dw-muted); font-size: 10.5px; }
.dw-summary dd { margin: 2px 0 0; font: 500 12px/1.3 var(--sc-font-mono); overflow-wrap: anywhere; }

.dw-section { padding: 14px 2px; border-top: 1px solid var(--dw-line); }
.dw-section > .dw-eyebrow { margin-bottom: 10px; }

.dw-rebar-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.dw-rebar-list li { display: flex; gap: 10px; align-items: flex-start; }
.dw-rebar-list li > div { display: grid; gap: 2px; min-width: 0; }
.dw-rebar-list strong { font: 600 13px/1.3 var(--sc-font-display); }
.dw-rebar-list small { color: var(--dw-muted); font: 11px/1.35 var(--sc-font-mono); }
.dw-swatch { flex: none; width: 10px; height: 10px; margin-top: 4px; border-radius: var(--sc-radius-pill); background: var(--dw-steel); }
.dw-swatch--stirrup { border-radius: 0; background: transparent; border: 2px solid var(--dw-muted); }
.dw-swatch--extra { background: var(--dw-bastion); }

.dw-table { width: 100%; border-collapse: collapse; font: 500 11.5px var(--sc-font-mono); }
.dw-table th, .dw-table td { padding: 5px 4px; border-bottom: 1px solid var(--dw-line); text-align: right; }
.dw-table thead th { color: var(--dw-muted); font: 600 10.5px var(--sc-font-ui); }
.dw-table th:first-child { text-align: left; }
.dw-table tbody th { color: var(--dw-muted); font-weight: 500; }
.dw-table td[data-status='fail'] { color: var(--dw-fail); }
.dw-section .dw-table + .dw-rebar-list { margin-top: 12px; }
.dw-footnote { margin: 6px 0 0; color: var(--dw-subtle); font-size: 10.5px; }

.dw-checks { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.dw-checks li { --status: var(--dw-pass); min-width: 0; }
.dw-checks li[data-status='fail'] { --status: var(--dw-fail); }
.dw-checks li[data-status='warning'] { --status: var(--dw-warn); }
.dw-checks li[data-status='info'] { --status: var(--dw-muted); }
.dw-checks li[data-status='out-of-scope'] { --status: var(--dw-subtle); }
.dw-checks__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--dw-ink);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
.dw-checks__row > svg { color: var(--status); }
.dw-checks__row b { font: 600 11.5px var(--sc-font-mono); color: var(--status); white-space: nowrap; }
.dw-checks__row:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }
.dw-checks .dw-meter--thin { margin: 0 0 6px 22px; }
.dw-checks__detail { display: grid; gap: 3px; margin: 0 0 8px 22px; }
.dw-checks small { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 8px; color: var(--dw-muted); font: 10.5px/1.35 var(--sc-font-mono); }
.dw-checks small em { margin-left: auto; font-style: normal; text-align: right; color: var(--dw-subtle); }
.dw-reference[data-basis='complementary'] { font-style: italic; }
.dw-reference[data-basis='complementary']::before { content: '◇ '; }
.dw-checks .dw-checks__note { display: block; font-family: var(--sc-font-ui); }
.dw-checks__trace { display: grid; gap: 2px; margin: 0; font-size: 11px; }
.dw-checks__trace > div { display: flex; gap: 8px; }
.dw-checks__trace dt { flex: none; width: 58px; color: var(--dw-subtle); }
.dw-checks__trace dd { margin: 0; min-width: 0; color: var(--dw-muted); overflow-wrap: anywhere; }

.dw-review { display: grid; gap: 10px; }
.dw-review__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.dw-review__order {
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid var(--dw-line);
  border-radius: var(--sc-radius-control, 6px);
  background: none;
  color: var(--dw-muted);
  font: 500 11px var(--sc-font-ui);
  cursor: pointer;
}
.dw-review__order[aria-pressed='true'] { color: var(--dw-ink); border-color: var(--dw-muted); }
.dw-review__order:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }
.dw-review__empty { margin: 4px 0; color: var(--dw-muted); font-size: 12px; }

.dw-values { display: grid; gap: 0; margin: 0; font-size: 11.5px; }
.dw-values > div { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px solid var(--dw-line); }
.dw-values > div:last-child { border-bottom: 0; }
.dw-values dt { color: var(--dw-muted); }
.dw-values dt b { color: var(--dw-ink); font: 500 11px var(--sc-font-mono); margin-right: 6px; }
.dw-values dd { margin: 0; text-align: right; font: 500 11.5px var(--sc-font-mono); white-space: nowrap; }

.dw-errors {
  display: flex;
  gap: 10px;
  align-self: center;
  max-width: 440px;
  margin-top: 40px;
  padding: 16px;
  border-radius: var(--sc-radius-card);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-raised);
  color: var(--dw-fail);
}
.dw-errors strong { color: var(--dw-ink); }
.dw-errors ul { margin: 6px 0 0; padding-left: 18px; color: var(--dw-ink); line-height: 1.45; }

/* Sin espacio para dos paneles: se abre uno a la vez (lo decide \`DesignWorkbench\`). */
@media (max-width: 1240px) {
  .dw-layout { --dw-panel-inputs: 292px; --dw-panel-results: 300px; }
  /* La barra inferior ocupa casi todo el ancho libre: el zoom sube sobre ella. */
  .dw-zoom { bottom: 76px; }
}

/*
 * Móvil: tres vistas a pantalla completa. Arriba el elemento, en medio la vista
 * elegida (dibujo, datos o resultados) y abajo pestañas fijas con el veredicto.
 * Nada se encima y el dibujo se ajusta al ancho; se amplía con dos dedos.
 */
@media (max-width: 760px) {
  .dw-layout, .dw-layout[data-inputs='open'], .dw-layout[data-results='open'] {
    --dw-left: 10px;
    --dw-right: 10px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: 0;
  }
  .dw-dock { display: contents; }
  .dw-dock__divider { display: none; }

  .dw-dock__group {
    grid-row: 1;
    grid-column: 1;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
    margin: 6px 8px;
    padding: 4px;
    border-radius: var(--sc-radius-card);
    background: var(--sc-color-surface-inset, var(--sc-color-surface-2));
    box-shadow: var(--sc-shadow-inset);
  }
  .dw-dock .sc-tool-button {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    min-height: 52px;
    padding: 6px 2px;
    font-size: 11px;
  }
  .dw-dock .sc-tool-button__copy strong { font-size: 11px; }
  /* Cinco elementos en un renglón: sin desbordar en 360 px. */
  .dw-dock__group .sc-tool-button { min-width: 0; overflow: hidden; }
  .dw-dock__group .sc-tool-button__copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .dw-stage, .dw-panel { grid-row: 2; grid-column: 1; }
  .dw-stage { margin: 0 8px; }
  .dw-layout[data-inputs='open'] .dw-stage, .dw-layout[data-results='open'] .dw-stage { visibility: hidden; }
  .dw-stage__scroll { padding: 54px 10px 64px; }
  .dw-hud { top: 10px; }
  .dw-hud--start { max-width: calc(100% - 150px); }
  .dw-badge--caption { display: none; }
  .dw-plate, .dw-plate--wide { flex-basis: 100%; }

  /* Zoom con dos dedos; sólo queda el botón para volver al tamaño normal. */
  .dw-zoom { bottom: 12px; }
  .dw-zoom__step { display: none !important; }
  .dw-zoom[data-zoomed='false'] { display: none; }

  .dw-panel, .dw-inputs, .dw-results {
    position: relative;
    inset: auto;
    width: auto;
    min-height: 0;
    margin: 0 8px;
    border-radius: var(--sc-radius-card);
    box-shadow: var(--sc-shadow-raised);
    transform: none;
    transition: none;
  }
  .dw-panel[data-open='false'] { display: none; }
  .dw-panel__close, .dw-panel__head--results { display: none; }
  .dw-panel__head { padding: 12px 8px 4px 16px; }
  .dw-panel__body { padding: 0 16px 24px; }
  .dw-results .dw-panel__body { padding-top: 14px; }
  .dw-icon-button { width: 40px; height: 40px; }

  .dw-views {
    grid-row: 3;
    grid-column: 1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
  }
  .dw-view, .dw-view--stage {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 54px;
    padding: 6px 4px;
    font-size: 11.5px;
  }
  .dw-view > span { display: block; }
  .dw-view > em { display: inline-flex; position: absolute; top: 7px; right: 8px; }
  .dw-view[aria-pressed='true'] { background: var(--sc-color-surface-1); box-shadow: var(--sc-shadow-raised); }
}

@media (prefers-reduced-motion: reduce) {
  .dw-meter i, .dw-more__toggle svg, .dw-panel, .dw-panel[data-open='false'], .dw-stage__scroll, .dw-hud, .dw-zoom, .dw-dock { transition: none; }
}

.dw-resultant circle { fill: var(--dw-moment); }
.dw-resultant text { fill: var(--dw-moment) !important; font-family: var(--sc-font-ui); font-weight: 600; font-size: 11px; }

/* ─── Memoria del proyecto ─── */
.dw-memory-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 10px;
  padding: 6px 6px 6px 10px;
  border: 1px solid var(--dw-line);
  border-radius: var(--sc-radius-control, 8px);
  font-size: 11.5px;
}
.dw-memory-status__open {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--dw-muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    color var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-memory-status__open:hover {
  color: var(--dw-ink);
}
.dw-memory-status__open:active {
  transform: var(--sc-press-transform);
}
.dw-memory-status__open span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dw-memory-status__open i { flex: none; width: 7px; height: 7px; border-radius: var(--sc-radius-pill); border: 1.5px solid var(--dw-subtle); }
.dw-memory-status[data-state='saved'] .dw-memory-status__open i { border-color: var(--dw-pass); background: var(--dw-pass); }
.dw-memory-status[data-state='dirty'] .dw-memory-status__open i { border-color: var(--dw-warn); background: var(--dw-warn); }
.dw-memory-status__save {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  min-height: 26px;
  padding: 0 9px;
  border: 1px solid var(--dw-line);
  border-radius: var(--sc-radius-control, 6px);
  background: var(--sc-color-surface-1);
  color: var(--dw-ink);
  font: 600 11px var(--sc-font-ui);
  cursor: pointer;
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    border-color var(--sc-motion-control) var(--sc-ease-standard),
    box-shadow var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-memory-status__save:hover:not(:disabled) {
  border-color: var(--dw-muted);
  transform: translateY(-1px);
}
.dw-memory-status__save:active:not(:disabled) {
  transform: var(--sc-press-transform);
  box-shadow: var(--sc-shadow-inset);
}
.dw-memory-status__open:focus-visible, .dw-memory-status__save:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }

/* El diálogo vive fuera de la mesa (portal): repite las variables que usan sus tablas. */
.dw-memory {
  --dw-ink: var(--sc-color-text-primary);
  --dw-muted: var(--sc-color-text-secondary);
  --dw-subtle: var(--sc-color-text-tertiary, var(--sc-color-text-secondary));
  --dw-line: var(--sc-color-border-soft, var(--sc-color-border));
  --dw-pass: var(--sc-color-state-success);
  --dw-fail: var(--sc-color-state-error);
  --dw-warn: var(--sc-color-state-warning);
  width: min(640px, calc(100vw - 32px));
}
.dw-memory .sc-modal-surface__footer { flex-wrap: wrap; }
.dw-memory__table { font-family: var(--sc-font-ui); }
.dw-memory__table th[scope='row'] { display: grid; gap: 2px; text-align: left; color: var(--dw-ink); }
.dw-memory__table th[scope='row'] strong { font: 600 12.5px/1.3 var(--sc-font-ui); }
.dw-memory__table th[scope='row'] small { color: var(--dw-muted); font: 11px var(--sc-font-ui); }
.dw-memory__table td { vertical-align: middle; font: 500 11.5px var(--sc-font-mono); }
.dw-memory__table td[data-status='pass'] { color: var(--dw-pass); }
.dw-memory__table td[data-status='warning'] { color: var(--dw-warn); }
.dw-memory__table td[data-status='fail'] { color: var(--dw-fail); }
.dw-memory__table tr[data-active] th[scope='row'] strong::after { content: ' · abierto'; color: var(--dw-muted); font-weight: 500; }
.dw-memory__actions { white-space: nowrap; }
.dw-memory__actions { text-align: right; }
.dw-memory__actions .dw-icon-button { display: inline-grid; margin-left: 2px; vertical-align: middle; }
.dw-memory__empty { margin: 4px 0; color: var(--dw-muted); font-size: 13px; line-height: 1.5; }
.dw-memory__notice { margin: 0 0 10px; color: var(--dw-muted); font-size: 12px; }
.dw-memory__confirm { display: grid; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-left: 2px solid var(--dw-warn); background: var(--sc-color-surface-inset); font-size: 12.5px; }
.dw-memory__confirm p { margin: 0; }
.dw-memory__confirm div { display: flex; flex-wrap: wrap; gap: 6px; }
@media (max-width: 840px) {
  /* En tablets y teléfonos el nombre del proyecto y acciones pesan más que deshacer. */
  .workspace-topbar .dw-topbar-history { display: none; }
}
@media (max-width: 480px) {
  .dw-memory .sc-modal-surface__footer .sc-button { flex: 1 1 100%; justify-content: center; }
}
.dw-drawing--wide { max-width: calc(640px * var(--z, 1)); margin-inline: auto; }
.dw-band-zone { fill: var(--dw-moment); opacity: .08; }
.dw-wall--masonry { stroke-dasharray: 4 2; }

/* ─── Acciones automáticas: Proponer, Aplicar ─── */
.dw-inline-action {
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid var(--dw-line);
  border-radius: var(--sc-radius-pill);
  background: var(--sc-color-surface-1);
  color: var(--dw-ink);
  font: 600 11px var(--sc-font-ui);
  cursor: pointer;
  transition:
    background-color var(--sc-motion-control) var(--sc-ease-standard),
    border-color var(--sc-motion-control) var(--sc-ease-standard),
    box-shadow var(--sc-motion-control) var(--sc-ease-standard),
    transform var(--sc-motion-control) var(--sc-ease-press);
}
.dw-inline-action:hover:not(:disabled) {
  border-color: var(--dw-muted);
  transform: translateY(-1px);
}
.dw-inline-action:active:not(:disabled) {
  transform: var(--sc-press-transform);
  box-shadow: var(--sc-shadow-inset);
}
.dw-inline-action:disabled { opacity: .45; cursor: default; }
.dw-inline-action:focus-visible { outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: 2px; }
.dw-action-note { margin: 0; color: var(--dw-muted); font-size: 11.5px; line-height: 1.4; }
.dw-slab-apply { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; font: 500 11.5px var(--sc-font-mono); color: var(--dw-muted); }

.dw-column-stub rect { fill: var(--sc-color-surface-2); stroke: var(--dw-ink); stroke-width: 1.1; }
.dw-cloud circle { fill: var(--sc-color-surface-1); stroke: var(--dw-moment); stroke-width: 1.4; opacity: .9; }
.dw-legend li[data-kind='cloud']::before { width: 7px; height: 7px; border: 1.4px solid var(--dw-moment); border-radius: var(--sc-radius-pill); background: var(--sc-color-surface-1); }

/* ─── Pórtico ─── */
.dw-frame { max-width: calc(980px * var(--z, 1)); margin-inline: auto; }
.dw-frame__member { stroke: var(--dw-ink); stroke-width: 4; stroke-linecap: round; }
.dw-frame__member--column { stroke-width: 5; }
.dw-frame__member[data-band='low'] { stroke: var(--dw-subtle); }
.dw-frame__member[data-band='mid'] { stroke: var(--dw-ink); }
.dw-frame__member[data-band='near'] { stroke: var(--fs-signal-attention); }
.dw-frame__member[data-band='fail'] { stroke: var(--dw-fail); stroke-width: 6; }
.dw-frame[data-kind='moment'] .dw-frame__member,
.dw-frame[data-kind='shear'] .dw-frame__member,
.dw-frame[data-kind='axial'] .dw-frame__member,
.dw-frame[data-kind='deformed'] .dw-frame__member { stroke: var(--dw-muted); stroke-width: 2.4; }
.dw-frame__selected { stroke: var(--dw-ink); stroke-width: 12; stroke-linecap: round; opacity: .16; pointer-events: none; }
.dw-frame__nodes circle { fill: var(--sc-color-surface-1); stroke: var(--dw-ink); stroke-width: 1.2; }
.dw-frame__deformed path { fill: none; stroke: var(--dw-deformed); stroke-width: 2.2; stroke-linejoin: round; }
.dw-frame__ratios text { font-weight: 600; font-size: 11px; paint-order: stroke; stroke: var(--sc-color-surface-1); stroke-width: 3px; }
.dw-frame__ratios text[data-band='low'] { fill: var(--dw-muted); }
.dw-frame__ratios text[data-band='near'] { fill: var(--fs-signal-attention-ink, var(--fs-signal-attention)); }
.dw-frame__ratios text[data-band='fail'] { fill: var(--dw-fail); }
.dw-frame__values text { font-weight: 600; font-size: 10.5px; paint-order: stroke; stroke: var(--sc-color-surface-1); stroke-width: 3px; }
.dw-frame__level { fill: var(--dw-muted) !important; font-weight: 600; }
.dw-frame__lateral line { stroke-width: 1.6; }
.dw-frame__hits line { stroke: transparent; stroke-width: 20; stroke-linecap: round; cursor: pointer; pointer-events: stroke; }
.dw-frame__hits line:focus-visible { outline: none; stroke: var(--sc-color-focus); stroke-opacity: .45; }
.dw-frame-legend li[data-kind='low']::before { border-top: 4px solid var(--dw-subtle); }
.dw-frame-legend li[data-kind='mid']::before { border-top: 4px solid var(--dw-ink); }
.dw-frame-legend li[data-kind='near']::before { border-top: 4px solid var(--fs-signal-attention); }
.dw-frame-legend li[data-kind='fail']::before { border-top: 5px solid var(--dw-fail); }

/* Matriz de miembros del pórtico: niveles por filas, viga y columnas por columnas. */
.dw-member-grid { width: 100%; border-collapse: separate; border-spacing: 3px; font-size: 11px; }
.dw-member-grid th { color: var(--dw-muted); font-weight: 600; text-align: center; }
.dw-member-grid th[scope='row'] { text-align: left; font-family: var(--sc-font-mono); }
.dw-member-grid button { width: 100%; min-height: 32px; padding: 2px 4px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-data); background: var(--sc-color-surface-1); color: var(--dw-ink); font: 600 11px var(--sc-font-mono); cursor: pointer; }
.dw-member-grid button[data-band='low'] { color: var(--dw-muted); }
.dw-member-grid button[data-band='near'] { color: var(--fs-signal-attention-ink, var(--fs-signal-attention)); border-color: var(--fs-signal-attention); }
.dw-member-grid button[data-band='fail'] { color: var(--dw-fail); border-color: var(--dw-fail); }
.dw-member-grid button[aria-pressed='true'] { background: var(--sc-color-fill-tertiary, var(--sc-color-surface-2)); border-color: var(--dw-ink); box-shadow: inset 0 0 0 1px var(--dw-ink); }
.dw-frame-diagram__select { display: none; }
@media (max-width: 760px) {
  .dw-frame-diagram__tabs { display: none !important; }
  .dw-frame-diagram__select { display: grid; }
}
.dw-frame__member[data-band='skip'] { stroke: var(--dw-subtle); stroke-dasharray: 5 4; stroke-width: 2; }
.dw-frame-legend li[data-kind='skip']::before { border-top: 2px dashed var(--dw-subtle); }
.dw-inline-action { display: inline-flex; align-items: center; justify-content: center; gap: 5px; }

/* Fichas por nivel: vigas (V, VA, VB…) y columnas (C1, C2…) con su cociente. */
.dw-member-grid td { padding: 0; }
.dw-member-grid__chips { display: flex; flex-wrap: wrap; gap: 3px; }
.dw-member-grid__chips button { display: grid; flex: 1 0 50px; justify-items: center; width: auto; padding: 3px 4px; line-height: 1.2; }
.dw-member-grid__chips span { color: var(--dw-muted); font-weight: 500; font-size: 10px; }
.dw-member-grid__chips b { font-weight: 600; }

/* Fuente «Modelo 2D»: lo que se leyó del modelo y lo que no entra. */
.dw-model-card { display: grid; gap: 8px; margin-top: 8px; padding: 10px 12px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-data); background: var(--sc-color-surface-1); color: var(--dw-muted); font-size: 11.5px; line-height: 1.45; }
.dw-model-card[data-state='error'] { border-color: var(--dw-fail); }
.dw-model-card strong { color: var(--dw-ink); font-size: 12.5px; overflow-wrap: anywhere; }
.dw-model-card dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 14px; margin: 0; }
.dw-model-card dl > div { display: flex; justify-content: space-between; gap: 6px; }
.dw-model-card dl > div:last-child { grid-column: 1 / -1; flex-direction: column; gap: 1px; }
.dw-model-card dd { margin: 0; color: var(--dw-ink); font: 500 11.5px var(--sc-font-mono); }
.dw-model-card p { margin: 0; }
.dw-model-card .dw-inline-action { justify-self: start; }
.dw-model-wait {
  display: flex;
  align-items: center;
  gap: 10px;
  align-self: center;
  margin-top: 40px;
  padding: 14px 16px;
  border-radius: var(--sc-radius-card);
  background: var(--sc-color-surface-1);
  box-shadow: var(--sc-shadow-raised);
  color: var(--dw-muted);
  font-size: 12.5px;
}
.dw-model-wait__dot { width: 8px; height: 8px; border-radius: var(--sc-radius-pill); background: var(--dw-muted); animation: dw-model-pulse 900ms var(--sc-ease-standard) infinite alternate; }
@keyframes dw-model-pulse { from { opacity: .25; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .dw-model-wait__dot { animation: none; } }
.dw-model-errors { display: grid; justify-items: center; gap: 12px; align-self: center; }
.dw-model-confirm { display: grid; gap: 6px; }
.dw-model-confirm p { color: var(--dw-ink); }
.dw-model-confirm div { display: flex; flex-wrap: wrap; gap: 6px; }

/* ─── Edificio: todos los ejes del Modelo 3D (BuildingAxes) ─── */
.dw-building { position: relative; display: grid; gap: 10px; }
.dw-plate:has(.dw-building__close) figcaption { padding-right: 36px; }
.dw-building__close { position: absolute; top: -30px; right: 0; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid var(--dw-line); border-radius: var(--sc-radius-control); background: var(--sc-color-surface-1); color: var(--dw-muted); cursor: pointer; }
.dw-building__close:hover { color: var(--dw-ink); }
.dw-building-plan { width: 100%; max-width: calc(560px * var(--z)); max-height: calc(380px * var(--z)); justify-self: center; }
.dw-building-plan__axis { cursor: pointer; outline: none; }
.dw-building-plan__axis line { stroke: var(--dw-subtle); stroke-width: 1.5; stroke-dasharray: 6 4; }
.dw-building-plan__axis line.dw-building-plan__hit { stroke: transparent; stroke-width: 16; stroke-dasharray: none; }
.dw-building-plan__axis circle { fill: var(--sc-color-surface-1); stroke: var(--dw-subtle); stroke-width: 1.5; }
.dw-building-plan__axis text { fill: var(--dw-muted); font: 600 10px var(--sc-font-mono); }
.dw-building-plan__axis[data-band='mid'] :is(line:not(.dw-building-plan__hit), circle) { stroke: var(--dw-ink); }
.dw-building-plan__axis[data-band='near'] :is(line:not(.dw-building-plan__hit), circle) { stroke: var(--fs-signal-attention); }
.dw-building-plan__axis[data-band='fail'] :is(line:not(.dw-building-plan__hit), circle) { stroke: var(--dw-fail); }
.dw-building-plan__axis[data-band='pending'] :is(line:not(.dw-building-plan__hit), circle) { opacity: .55; }
.dw-building-plan__axis[data-current] line:not(.dw-building-plan__hit) { stroke-width: 3; stroke-dasharray: none; }
.dw-building-plan__axis[data-current] text { fill: var(--dw-ink); }
.dw-building-plan__axis:is(:hover, :focus-visible) line:not(.dw-building-plan__hit) { stroke-width: 3; }
.dw-building-plan__axis:focus-visible circle { stroke-width: 3; }
.dw-building-plan__column { fill: var(--sc-color-surface-1); stroke: var(--dw-ink); stroke-width: 1.5; }
.dw-building-plan__column[data-band='low'] { fill: var(--dw-subtle); stroke: var(--dw-subtle); }
.dw-building-plan__column[data-band='mid'] { fill: var(--dw-ink); }
.dw-building-plan__column[data-band='near'] { fill: var(--fs-signal-attention); stroke: var(--fs-signal-attention); }
.dw-building-plan__column[data-band='fail'] { fill: var(--dw-fail); stroke: var(--dw-fail); }
.dw-building-plan__column[data-band='pending'] { stroke-dasharray: 2 2; }
.dw-building__table td[data-band='low'] { color: var(--dw-muted); }
.dw-building__table td[data-band='near'] { color: var(--fs-signal-attention-ink, var(--fs-signal-attention)); }
.dw-building__table td[data-band='fail'] { color: var(--dw-fail); }
.dw-building__table tr[data-active] th { color: var(--dw-ink); font-weight: 600; }
.dw-building__error { color: var(--dw-fail); text-align: left !important; font-family: var(--sc-font-ui); white-space: normal; }
.dw-building__pending { color: var(--dw-subtle); text-align: left !important; font-family: var(--sc-font-ui); }
.dw-building__table .dw-inline-action { min-height: 28px; }
.dw-building__save { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.dw-building__save span { color: var(--dw-muted); font-size: 11px; line-height: 1.5; }

/* Propuesta de secciones del Modelo 2D: se lee y se aplica (o se descarta). */
.dw-proposal {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--dw-line);
  border-radius: var(--sc-radius-md, 10px);
  background: var(--sc-color-surface-1);
}
.dw-proposal p { margin: 0; color: var(--dw-ink); font-size: 11.5px; line-height: 1.5; }
.dw-proposal__actions { display: flex; flex-wrap: wrap; gap: 8px; }
`)?.[1]??``).split(`
`).filter(e=>e.trim().startsWith(`--`)).join(`
`)}\n}\n${b}\n${x}\n${S}`}var ee,w=40;function T(e){let t=(0,y.renderToStaticMarkup)(e),n=/^<svg\b[^>]*>/.exec(t),r=n?/viewBox="([\d.\s-]+)"/.exec(n[0]):null;if(!n||!r)return null;let[i=0,a=0,o,s]=r[1].trim().split(/\s+/).map(Number);if(!o||!s)return null;ee??=C();let c=o+2*w,l=s+2*w,u=n[0].includes(`xmlns=`)?``:` xmlns="http://www.w3.org/2000/svg"`,d=n[0].replace(r[0],`viewBox="${i-w} ${a-w} ${c} ${l}"`).replace(`<svg`,`<svg${u} width="${c}" height="${l}"`),f=`svg.dw-drawing { width: ${c}px !important; height: ${l}px !important; max-width: none !important; margin: 0 !important; }`;return{markup:`${d}${`<style><![CDATA[${ee.replaceAll(`]]>`,`]] >`)}\n${f}]]></style>`}${t.slice(n[0].length)}`,width:c,height:l}}var E=4e3;async function D(e,t=3){if(typeof document>`u`||typeof Image>`u`||typeof URL.createObjectURL!=`function`)return null;let n=T(e);if(!n)return null;let r=document.createElement(`canvas`),i=null;try{i=r.getContext(`2d`)}catch{return null}if(!i)return null;let a=URL.createObjectURL(new Blob([n.markup],{type:`image/svg+xml;charset=utf-8`}));try{let e=new Image,o=new Promise(t=>{e.onload=()=>t(!0),e.onerror=()=>t(!1),setTimeout(()=>t(!1),E)});if(e.src=a,!await o)return null;r.width=Math.round(n.width*t),r.height=Math.round(n.height*t),i.fillStyle=`#ffffff`,i.fillRect(0,0,r.width,r.height),i.drawImage(e,0,0,r.width,r.height);let s=await new Promise(e=>r.toBlob(e,`image/png`));return s?{png:new Uint8Array(await s.arrayBuffer()),width:n.width,height:n.height}:null}catch{return null}finally{URL.revokeObjectURL(a)}}var O=`Memoria de diseño · Experimental`,k={pass:`Cumple`,fail:`No cumple`,warning:`Revisar`,info:`Nota`,"out-of-scope":`Sin evaluar`},A={beam:`Viga`,column:`Columna`,frame:`Estructura`,footing:`Cimentación`,section:`Sección experimental`},j=(e,t)=>e===void 0||!Number.isFinite(e)?`—`:`${e.toLocaleString(`es-MX`,{maximumFractionDigits:t===``?2:1})}${t?` ${t}`:``}`,M=e=>e===void 0||!Number.isFinite(e)?`—`:`${Math.round(e*100)} %`,N=e=>`${e.toLocaleString(`es-MX`,{minimumFractionDigits:1,maximumFractionDigits:1})} kg`,P=e=>e.status===`fail`?`No cumple`:e.status===`warning`?`Con observaciones`:e.outOfScope.length?`Cumple lo evaluado`:`Cumple`,F=e=>e.replaceAll(`²`,`2`).replaceAll(`³`,`3`);function te(e){return typeof e==`string`?F(e):Array.isArray(e)?e.map(te):e&&typeof e==`object`&&Object.getPrototypeOf(e)===Object.prototype?Object.fromEntries(Object.entries(e).map(([e,t])=>[e,e===`input`?t:te(t)])):e}async function ne(e,t){let n=[];for(let r of t){let t=await D(r.render());t&&n.push({figure:r,raster:t,image:await e.embedPng(t.png)})}return n}var I=e=>`${e.figure.title}${e.figure.note?` (${e.figure.note})`:``}`;function L(e,t){let n=e=>e.raster.width<=320;for(let r=0;r<t.length;r+=1){let i=t[r],a=t[r+1];if(n(i)&&a&&n(a)){let t=(e.contentWidth-24)/2,n=e=>{let n=Math.min(t,e.raster.width*.8);return{width:n,height:n*e.raster.height/e.raster.width}},[o,s]=[n(i),n(a)],c=Math.max(o.height,s.height);e.figure(c,n=>{e.page.drawImage(i.image,{x:n.x+(t-o.width)/2,y:n.y+c-o.height,width:o.width,height:o.height}),e.page.drawImage(a.image,{x:n.x+t+24+(t-s.width)/2,y:n.y+c-s.height,width:s.width,height:s.height})},`izquierda, ${I(i)}; derecha, ${I(a)}`),r+=1;continue}let o=Math.min(e.contentWidth,i.raster.width*(n(i)?.8:.62)),s=Math.min(520,o*i.raster.height/i.raster.width),c=s*i.raster.width/i.raster.height;e.figure(s,t=>{e.page.drawImage(i.image,{x:t.x+(t.width-c)/2,y:t.y,width:c,height:s})},I(i))}}async function re(e,t,n,i){let{palette:a}=e,o=te(n),s=p(o.code),c=o.outOfScope.length>0,l=await m(n);e.part(f(o),[A[o.element],o.place,o.basisLabel??`${s.name} · ${s.country}`].filter(Boolean).join(` · `)),e.metrics([{label:`Estado`,value:o.status===`fail`?`No cumple`:o.status===`warning`?`Observado`:`Cumple`,detail:c&&o.status!==`fail`?`lo evaluado · revisión incompleta`:void 0,color:o.status===`fail`?a.danger:o.status===`warning`?a.warn:a.ok},{label:`Utilización que rige`,value:M(o.governingRatio)},{label:`Acero`,value:N(o.takeoff.steelKg),detail:`${o.takeoff.steelRatioKgM3.toFixed(0)} kg/m3 de concreto`},{label:`Sin evaluar`,value:String(o.outOfScope.length),detail:`fuera del alcance`}]),c&&e.callout(`warn`,`Revisión incompleta`,`Lo evaluado ${o.status===`fail`?`no cumple`:`cumple`}, pero ${o.outOfScope.length} verificaciones que la norma pide quedan fuera del alcance del taller (apartado «Fuera de alcance»). El elemento no puede declararse conforme sin revisarlas.`),e.heading(`Datos de entrada`);for(let t of o.data)e.heading(t.title,3),e.keyValues(t.rows.map(e=>[e.label,e.value]),150);if(e.heading(`Armado`),e.keyValues(o.reinforcement.map(e=>[e.label,e.value]),150),o.alternative&&(e.heading(`Armado propio frente al propuesto`,3),e.table([{header:`Armado`,flex:2},{header:`Estado`,width:70},{header:`Rige`,width:50,align:`right`},{header:`Acero`,width:70,align:`right`}],[[`Propio (el de esta memoria)`,k[o.status],M(o.governingRatio),N(o.takeoff.steelKg)],[o.alternative.label,k[o.alternative.status],M(o.alternative.governingRatio),N(o.alternative.steelKg)]])),i.figures!==!1&&o.figures.length){let n=await ne(t,o.figures);n.length&&(e.heading(`Láminas`),L(e,n))}e.heading(`Comprobaciones`),e.note(`Demanda frente a capacidad de diseño. * = criterio complementario, no cláusula con evidencia en el registro normativo.`),e.table([{header:`Comprobación`,flex:2.2},{header:`Estado`,width:58},{header:`Demanda`,width:66,align:`right`},{header:`Capacidad`,width:66,align:`right`},{header:`%`,width:36,align:`right`},{header:`Referencia`,flex:1.2}],o.checks.map(e=>[e.label,k[e.status],j(e.demand,e.unit),j(e.capacity,e.unit),M(e.ratio),`${e.reference.standard===`complementary`?`* `:``}${e.reference.label}`]));let h=o.checks.filter(e=>e.location||e.combination||e.note);if(h.length){e.heading(`Trazabilidad`,2),e.note(`Dónde rige cada comprobación, de qué combinación sale la demanda y qué cláusulas la respaldan.`);for(let t of h)e.heading(t.label,3),e.keyValues([...t.location?[[`Rige en`,t.location]]:[],...t.combination?[[`Demanda`,t.combination]]:[],...t.note?[[`Nota`,t.note]]:[],...t.reference.clauseIds.length?[[`Cláusulas`,t.reference.clauseIds.join(`, `)]]:[]],90)}e.heading(`Valores intermedios`),e.table([{header:`Símbolo`,width:80},{header:`Concepto`,flex:2},{header:`Valor`,flex:1.3,align:`right`}],o.values.map(e=>[e.symbol,e.label,e.value]));for(let t of o.tables)e.heading(t.title,3),e.table(t.columns.map((e,t)=>({header:e,flex:1,align:t===0?`left`:`right`})),t.rows);e.heading(`Cuantificación`),e.table([{header:`Pieza`,flex:2.4},{header:`Varilla`,width:50},{header:`Piezas`,width:48,align:`right`},{header:`Long. (m)`,width:58,align:`right`},{header:`Masa`,width:66,align:`right`}],[...o.takeoff.lines.map(e=>[e.mark,u(e.diameterMm),String(e.count),e.pieceLengthM.toFixed(2),N(e.massKg)]),[`Total de acero`,``,``,``,N(o.takeoff.steelKg)]]),e.keyValues([[`Concreto`,`${o.takeoff.concreteM3.toFixed(3)} m3`],[`Cuantía`,`${o.takeoff.steelRatioKgM3.toFixed(0)} kg de acero por m3 de concreto`]],150),e.note(o.takeoff.basis),o.notes.length&&(e.heading(`Notas del cálculo`),e.keyValues(o.notes.map(e=>[e.label,`${e.note??``} (${e.reference.label})`]),150)),e.heading(`Fuera de alcance`),e.note(o.basisLabel?`Verificaciones fuera del modelo experimental. Deben resolverse aparte.`:`Verificaciones que la norma pide y el taller no calcula. Deben resolverse aparte.`),o.outOfScope.length?e.keyValues(o.outOfScope.map(e=>[e.label,e.note??``]),150):e.text(`Todas las verificaciones declaradas para este elemento se evaluaron.`),e.heading(`Instantánea`),e.note(`La huella identifica la entrada exacta: la misma entrada, norma y versión reproducen este cálculo.`),e.keyValues([[o.basisLabel?`Modelo`:`Norma`,o.basisLabel??`${s.name} · ${s.country}`],[`FStructure`,r],[`Huella SHA-256`,l]],110),e.heading(`Entrada del motor, en sus unidades internas`,3),e.note(d(o.input))}function ie(e,t,n,i){let a=[...new Set(t.map(e=>e.basisLabel??`${p(e.code).name} · ${p(e.code).country}`))];e.label(`Memoria de cálculo · Diseño de elementos de concreto`),e.heading(n.projectName?.trim()||`Proyecto sin título`),e.keyValues([[`Bases de cálculo`,a.join(`; `)],[`Elementos`,String(t.length)],[`Fecha`,i.toLocaleDateString(`es-MX`,{year:`numeric`,month:`long`,day:`numeric`})],[`Programa`,`FStructure ${r} · FS-A04 Diseño (experimental)`]],110),e.callout(`neutral`,`Alcance`,`Cálculo preliminar para revisión profesional; no es un documento de construcción. Cada elemento declara lo que el taller no evalúa. La responsabilidad del diseño es de quien lo firma.`),e.heading(`Índice de elementos`),e.table([{header:`Clave`,width:60},{header:`Elemento`,flex:1.6},{header:`Ubicación`,flex:1.3},{header:`Estado`,flex:1.1},{header:`Rige`,width:42,align:`right`},{header:`Acero`,width:64,align:`right`}],t.map(e=>[e.tag||`—`,e.title,e.place||`—`,P(e),M(e.governingRatio),N(e.takeoff.steelKg)]));let o=t.reduce((e,t)=>e+t.takeoff.steelKg,0),s=t.reduce((e,t)=>e+t.takeoff.concreteM3,0),c=t.filter(e=>e.status===`fail`).length;e.keyValues([[`Acero total`,N(o)],[`Concreto total`,`${s.toFixed(3)} m3`],[`No cumplen`,c?`${c} de ${t.length}`:`ninguno`]],110),e.heading(`Responsiva`),e.keyValues([[`Elaboró`,`_____________________________________   Cédula: ______________`],[`Revisó`,`_____________________________________   Cédula: ______________`],[`Fecha y firma`,`_____________________________________`]],110)}async function R(e,t={}){if(!e.length)throw Error(`La memoria necesita al menos un elemento.`);let n=t.generatedAt??new Date,u=await i.create();u.setTitle(`${e.length===1?f(e[0]):t.projectName?.trim()||`Memoria de diseño`} · ${O}`),u.setProducer(`FStructure ${r}`),u.setCreationDate(n);let d=new g(u,{regular:await u.embedFont(a.Helvetica),bold:await u.embedFont(a.HelveticaBold),mathRegular:await u.embedFont(a.TimesRoman),mathItalic:await u.embedFont(a.TimesRomanItalic),mathSymbol:await u.embedFont(a.Symbol)},h(l),l,{concatTransformationMatrix:o,pushGraphicsState:c,popGraphicsState:s});ie(d,e,t,n);for(let n of e)await re(d,u,n,t);return d.stampChrome(t.projectName?.trim()||`FStructure · Diseño`,O),u.save()}export{R as buildDesignMemoriaPdf};