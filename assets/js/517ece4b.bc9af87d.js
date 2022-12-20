"use strict";(self.webpackChunk_azure_static_web_apps_cli_docs=self.webpackChunk_azure_static_web_apps_cli_docs||[]).push([[811],{3905:function(e,t,n){n.d(t,{Zo:function(){return u},kt:function(){return f}});var r=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function o(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function c(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var l=r.createContext({}),s=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):o(o({},t),e)),n},u=function(e){var t=s(e.components);return r.createElement(l.Provider,{value:t},e.children)},p={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},d=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,i=e.originalType,l=e.parentName,u=c(e,["components","mdxType","originalType","parentName"]),d=s(n),f=a,m=d["".concat(l,".").concat(f)]||d[f]||p[f]||i;return n?r.createElement(m,o(o({ref:t},u),{},{components:n})):r.createElement(m,o({ref:t},u))}));function f(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var i=n.length,o=new Array(i);o[0]=d;var c={};for(var l in t)hasOwnProperty.call(t,l)&&(c[l]=t[l]);c.originalType=e,c.mdxType="string"==typeof e?e:a,o[1]=c;for(var s=2;s<i;s++)o[s]=n[s];return r.createElement.apply(null,o)}return r.createElement.apply(null,n)}d.displayName="MDXCreateElement"},4610:function(e,t,n){n.r(t),n.d(t,{assets:function(){return u},contentTitle:function(){return l},default:function(){return f},frontMatter:function(){return c},metadata:function(){return s},toc:function(){return p}});var r=n(7462),a=n(3366),i=(n(7294),n(3905)),o=["components"],c={sidebar_position:9,title:"Local Authentication"},l=void 0,s={unversionedId:"cli/local-auth",id:"cli/local-auth",title:"Local Authentication",description:"The CLI allows to mock and read authentication and authorization credentials.",source:"@site/docs/cli/local-auth.md",sourceDirName:"cli",slug:"/cli/local-auth",permalink:"/static-web-apps-cli/docs/cli/local-auth",editUrl:"https://github.com/azure/static-web-apps-cli/tree/main/docs/www/docs/cli/local-auth.md",tags:[],version:"current",sidebarPosition:9,frontMatter:{sidebar_position:9,title:"Local Authentication"},sidebar:"tutorialSidebar",previous:{title:"Configuration file",permalink:"/static-web-apps-cli/docs/cli/swa-config"},next:{title:"Run in Docker",permalink:"/static-web-apps-cli/docs/cli/docker"}},u={},p=[{value:"Mocking credentials",id:"mocking-credentials",level:3},{value:"Reading credentials",id:"reading-credentials",level:3}],d={toc:p};function f(e){var t=e.components,c=(0,a.Z)(e,o);return(0,i.kt)("wrapper",(0,r.Z)({},d,c,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("p",null,"The CLI allows to mock and read authentication and authorization credentials."),(0,i.kt)("h3",{id:"mocking-credentials"},"Mocking credentials"),(0,i.kt)("p",null,"When requesting the Static Web Apps login endpoints (",(0,i.kt)("inlineCode",{parentName:"p"},"http://localhost:4280/.auth/login/<PROVIDER_NAME>"),"), you have access to a local authentication UI. This interface is served locally from the emulator and allows you to set fake user information for the current user from the provider supplied."),(0,i.kt)("p",null,(0,i.kt)("img",{alt:"swa cli architecture",src:n(6307).Z,width:"1037",height:"863"})),(0,i.kt)("h3",{id:"reading-credentials"},"Reading credentials"),(0,i.kt)("p",null,"The front-end application can request the ",(0,i.kt)("inlineCode",{parentName:"p"},"http://localhost:4280/.auth/me")," endpoint and a ",(0,i.kt)("inlineCode",{parentName:"p"},"clientPrincipal")," containing the fake information will be returned by the authentication API."),(0,i.kt)("p",null,"Here is an example:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-json"},'{\n  "clientPrincipal": {\n    "identityProvider": "twitter",\n    "userId": "<USER-UUID>",\n    "userDetails": "<USER_NAME>",\n    "userRoles": ["anonymous", "authenticated"],\n    "claims": [\n      {\n        "typ": "name",\n        "val": "Azure Static Web Apps"\n      }\n    ]\n  }\n}\n')),(0,i.kt)("p",null,"The API functions can access user information using the ",(0,i.kt)("inlineCode",{parentName:"p"},"x-ms-client-principal")," header."),(0,i.kt)("p",null,"See ",(0,i.kt)("a",{parentName:"p",href:"https://docs.microsoft.com/azure/static-web-apps/user-information"},"Accessing user information")," documentation for more details."))}f.isMDXComponent=!0},6307:function(e,t,n){t.Z=n.p+"assets/images/swa-cli-local-auth-6c6f8f6d7897fc4de7a5fe066dbf1a53.png"}}]);