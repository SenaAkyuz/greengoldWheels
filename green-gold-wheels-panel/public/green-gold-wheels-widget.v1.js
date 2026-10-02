var GreenGoldWheelsWidget=(function(e){Object.defineProperty(e,Symbol.toStringTag,{value:`Module`});var t,n,r,i,a,o,s,c,l,u,d,f,p,m,h={},g=[],_=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,v=Array.isArray;function y(e,t){for(var n in t)e[n]=t[n];return e}function b(e){e&&e.parentNode&&e.parentNode.removeChild(e)}function x(e,n,r){var i,a,o,s={};for(o in n)o==`key`?i=n[o]:o==`ref`?a=n[o]:s[o]=n[o];if(arguments.length>2&&(s.children=arguments.length>3?t.call(arguments,2):r),typeof e==`function`&&e.defaultProps!=null)for(o in e.defaultProps)s[o]===void 0&&(s[o]=e.defaultProps[o]);return S(e,s,i,a,null)}function S(e,t,i,a,o){var s={type:e,props:t,key:i,ref:a,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:o??++r,__i:-1,__u:0};return o==null&&n.vnode!=null&&n.vnode(s),s}function C(e){return e.children}function w(e,t){this.props=e,this.context=t}function T(e,t){if(t==null)return e.__?T(e.__,e.__i+1):null;for(var n;t<e.__k.length;t++)if((n=e.__k[t])!=null&&n.__e!=null)return n.__e;return typeof e.type==`function`?T(e):null}function E(e){if(e.__P&&e.__d){var t=e.__v,r=t.__e,i=[],a=[],o=y({},t);o.__v=t.__v+1,n.vnode&&n.vnode(o),L(e.__P,o,t,e.__n,e.__P.namespaceURI,32&t.__u?[r]:null,i,r??T(t),!!(32&t.__u),a),o.__v=t.__v,o.__.__k[o.__i]=o,ee(i,o,a),t.__e=t.__=null,o.__e!=r&&D(o)}}function D(e){if((e=e.__)!=null&&e.__c!=null)return e.__e=e.__c.base=null,e.__k.some(function(t){if(t!=null&&t.__e!=null)return e.__e=e.__c.base=t.__e}),D(e)}function O(e){(!e.__d&&(e.__d=!0)&&i.push(e)&&!k.__r++||a!=n.debounceRendering)&&((a=n.debounceRendering)||o)(k)}function k(){try{for(var e,t=1;i.length;)i.length>t&&i.sort(s),e=i.shift(),t=i.length,E(e)}finally{i.length=k.__r=0}}function A(e,t,n,r,i,a,o,s,c,l,u){var d,f,p,m,_,v,y=r&&r.__k||g,b=t.length;for(c=j(n,t,y,c,b),d=0;d<b;d++)(p=n.__k[d])!=null&&(f=p.__i!=-1&&y[p.__i]||h,p.__i=d,v=L(e,p,f,i,a,o,s,c,l,u),m=p.__e,p.ref&&f.ref!=p.ref&&(f.ref&&z(f.ref,null,p),u.push(p.ref,p.__c||m,p)),_==null&&m!=null&&(_=m),4&p.__u?(c=M(p,c,e),f.__e&&(f.__e=null)):typeof p.type==`function`&&v!==void 0?c=v:m&&(c=m.nextSibling),p.__u&=-7);return n.__e=_,c}function j(e,t,n,r,i){var a,o,s,c,l,u=n.length,d=u,f=0;for(e.__k=Array(i),a=0;a<i;a++)(o=t[a])!=null&&typeof o!=`boolean`&&typeof o!=`function`?(typeof o==`string`||typeof o==`number`||typeof o==`bigint`||o.constructor==String?o=e.__k[a]=S(null,o,null,null,null):v(o)?o=e.__k[a]=S(C,{children:o},null,null,null):o.constructor===void 0&&o.__b>0?o=e.__k[a]=S(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):e.__k[a]=o,c=a+f,o.__=e,o.__b=e.__b+1,s=null,(l=o.__i=N(o,n,c,d))!=-1&&(d--,(s=n[l])&&(s.__u|=2)),s==null||s.__v==null?(l==-1&&(i>u?f--:i<u&&f++),typeof o.type!=`function`&&(o.__u|=4)):l!=c&&(l==c-1?f--:l==c+1?f++:(l>c?f--:f++,o.__u|=4))):e.__k[a]=null;if(d)for(a=0;a<u;a++)(s=n[a])!=null&&!(2&s.__u)&&(s.__e==r&&(r=T(s)),re(s,s));return r}function M(e,t,n){var r,i;if(typeof e.type==`function`){for(r=e.__k,i=0;r&&i<r.length;i++)r[i]&&(r[i].__=e,t=M(r[i],t,n));return t}e.__e!=t&&(t&&e.type&&!t.parentNode&&(t=T(e)),t=n.insertBefore(e.__e,t||null));do t&&=t.nextSibling;while(t!=null&&t.nodeType==8);return t}function N(e,t,n,r){var i,a,o,s=e.key,c=e.type,l=t[n],u=l!=null&&!(2&l.__u);if(l===null&&s==null||u&&s==l.key&&c==l.type)return n;if(r>+!!u){for(i=n-1,a=n+1;i>=0||a<t.length;)if((l=t[o=i>=0?i--:a++])!=null&&!(2&l.__u)&&s==l.key&&c==l.type)return o}return-1}function P(e,t,n){t[0]==`-`?e.setProperty(t,n??``):e[t]=n==null?``:typeof n!=`number`||_.test(t)?n:n+`px`}function F(e,t,n,r,i){var a,o;n:if(t==`style`){if(typeof n==`string`)e.style.cssText=n;else{if(typeof r==`string`&&(e.style.cssText=r=``),r)for(t in r)n&&t in n||P(e.style,t,``);if(n)for(t in n)r&&n[t]==r[t]||P(e.style,t,n[t])}}else if(t[0]==`o`&&t[1]==`n`)a=t!=(t=t.replace(d,`$1`)),o=t.toLowerCase(),t=o in e||t==`onFocusOut`||t==`onFocusIn`?o.slice(2):t.slice(2),e.l||={},e.l[t+a]=n,n?r?n[u]=r[u]:(n[u]=f,e.addEventListener(t,a?m:p,a)):e.removeEventListener(t,a?m:p,a);else{if(i==`http://www.w3.org/2000/svg`)t=t.replace(/xlink(H|:h)/,`h`).replace(/sName$/,`s`);else if(t!=`width`&&t!=`height`&&t!=`href`&&t!=`list`&&t!=`form`&&t!=`tabIndex`&&t!=`download`&&t!=`rowSpan`&&t!=`colSpan`&&t!=`role`&&t!=`popover`&&t in e)try{e[t]=n??``;break n}catch{}typeof n==`function`||(n==null||!1===n&&t[4]!=`-`?e.removeAttribute(t):e.setAttribute(t,t==`popover`&&n==1?``:n))}}function I(e){return function(t){if(this.l){var r=this.l[t.type+e];if(t[l]==null)t[l]=f++;else if(t[l]<r[u])return;return r(n.event?n.event(t):t)}}}function L(e,t,r,i,a,o,s,c,l,u){var d,f,p,m,h,_,x,S,E,D,O,k,j,M,N,P,F=t.type;if(t.constructor!==void 0)return null;128&r.__u&&(l=!!(32&r.__u),o=[c=t.__e=r.__e]),(d=n.__b)&&d(t);n:if(typeof F==`function`){f=s.length;try{if(E=t.props,D=F.prototype&&F.prototype.render,O=(d=F.contextType)&&i[d.__c],k=d?O?O.props.value:d.__:i,r.__c?S=(p=t.__c=r.__c).__=p.__E:(D?t.__c=p=new F(E,k):(t.__c=p=new w(E,k),p.constructor=F,p.render=ie),O&&O.sub(p),p.state||(p.state={}),p.__n=i,m=p.__d=!0,p.__h=[],p._sb=[]),D&&p.__s==null&&(p.__s=p.state),D&&F.getDerivedStateFromProps!=null&&(p.__s==p.state&&(p.__s=y({},p.__s)),y(p.__s,F.getDerivedStateFromProps(E,p.__s))),h=p.props,_=p.state,p.__v=t,m)D&&F.getDerivedStateFromProps==null&&p.componentWillMount!=null&&p.componentWillMount(),D&&p.componentDidMount!=null&&p.__h.push(p.componentDidMount);else{if(D&&F.getDerivedStateFromProps==null&&E!==h&&p.componentWillReceiveProps!=null&&p.componentWillReceiveProps(E,k),t.__v==r.__v||!p.__e&&p.shouldComponentUpdate!=null&&!1===p.shouldComponentUpdate(E,p.__s,k)){t.__v!=r.__v&&(p.props=E,p.state=p.__s,p.__d=!1),t.__e=r.__e,t.__k=r.__k,t.__k.some(function(e){e&&(e.__=t)}),g.push.apply(p.__h,p._sb),p._sb=[],p.__h.length&&s.push(p),c=T(r);break n}p.componentWillUpdate!=null&&p.componentWillUpdate(E,p.__s,k),D&&p.componentDidUpdate!=null&&p.__h.push(function(){p.componentDidUpdate(h,_,x)})}if(p.context=k,p.props=E,p.__P=e,p.__e=!1,j=n.__r,M=0,D)p.state=p.__s,p.__d=!1,j&&j(t),d=p.render(p.props,p.state,p.context),g.push.apply(p.__h,p._sb),p._sb=[];else do p.__d=!1,j&&j(t),d=p.render(p.props,p.state,p.context),p.state=p.__s;while(p.__d&&++M<25);p.state=p.__s,p.getChildContext!=null&&(i=y(y({},i),p.getChildContext())),D&&!m&&p.getSnapshotBeforeUpdate!=null&&(x=p.getSnapshotBeforeUpdate(h,_)),N=d!=null&&d.type===C&&d.key==null?te(d.props.children):d,c=A(e,v(N)?N:[N],t,r,i,a,o,s,c,l,u),p.base=t.__e,t.__u&=-161,p.__h.length&&s.push(p),S&&(p.__E=p.__=null)}catch(e){if(s.length=f,t.__v=null,l||o!=null){if(e.then){for(t.__u|=l?160:128;c&&c.nodeType==8&&c.nextSibling;)c=c.nextSibling;o!=null&&(o[o.indexOf(c)]=null),t.__e=c}else if(o!=null)for(P=o.length;P--;)b(o[P])}else t.__e=r.__e;t.__k??=r.__k||[],e.then||R(t),n.__e(e,t,r)}}else o==null&&t.__v==r.__v?(t.__k=r.__k,t.__e=r.__e):c=t.__e=ne(r.__e,t,r,i,a,o,s,l,u);return(d=n.diffed)&&d(t),128&t.__u?void 0:c}function R(e){e&&(e.__c&&(e.__c.__e=!0),e.__k&&e.__k.some(R))}function ee(e,t,r){for(var i=0;i<r.length;i++)z(r[i],r[++i],r[++i]);n.__c&&n.__c(t,e),e.some(function(t){try{e=t.__h,t.__h=[],e.some(function(e){e.call(t)})}catch(e){n.__e(e,t.__v)}})}function te(e){return typeof e!=`object`||!e||e.__b>0?e:v(e)?e.map(te):e.constructor===void 0?y({},e):null}function ne(e,r,i,a,o,s,c,l,u){var d,f,p,m,g,_,y,x=i.props||h,S=r.props,C=r.type;if(C==`svg`?o=`http://www.w3.org/2000/svg`:C==`math`?o=`http://www.w3.org/1998/Math/MathML`:o||=`http://www.w3.org/1999/xhtml`,s!=null){for(d=0;d<s.length;d++)if((g=s[d])&&`setAttribute`in g==!!C&&(C?g.localName==C:g.nodeType==3)){e=g,s[d]=null;break}}if(e==null){if(C==null)return document.createTextNode(S);e=document.createElementNS(o,C,S.is&&S),l&&=(n.__m&&n.__m(r,s),!1),s=null}if(C==null)x===S||l&&e.data==S||(e.data=S);else{if(s=C==`textarea`&&S.defaultValue!=null?null:s&&t.call(e.childNodes),!l&&s!=null)for(x={},d=0;d<e.attributes.length;d++)x[(g=e.attributes[d]).name]=g.value;for(d in x)g=x[d],d==`dangerouslySetInnerHTML`?p=g:d==`children`||d in S||d==`value`&&`defaultValue`in S||d==`checked`&&`defaultChecked`in S||F(e,d,null,g,o);for(d in S)g=S[d],d==`children`?m=g:d==`dangerouslySetInnerHTML`?f=g:d==`value`?_=g:d==`checked`?y=g:l&&typeof g!=`function`||x[d]===g||F(e,d,g,x[d],o);if(f)l||p&&(f.__html==p.__html||f.__html==e.innerHTML)||(e.innerHTML=f.__html),r.__k=[];else if(p&&(e.innerHTML=``),A(r.type==`template`?e.content:e,v(m)?m:[m],r,i,a,C==`foreignObject`?`http://www.w3.org/1999/xhtml`:o,s,c,s?s[0]:i.__k&&T(i,0),l,u),s!=null)for(d=s.length;d--;)b(s[d]);l&&C!=`textarea`||(d=`value`,C==`progress`&&_==null?e.removeAttribute(`value`):_!=null&&(_!==e[d]||C==`progress`&&!_||C==`option`&&_!=x[d])&&F(e,d,_,x[d],o),d=`checked`,y!=null&&y!=e[d]&&F(e,d,y,x[d],o))}return e}function z(e,t,r){try{if(typeof e==`function`){var i=typeof e.__u==`function`;i&&e.__u(),i&&t==null||(e.__u=e(t))}else e.current=t}catch(e){n.__e(e,r)}}function re(e,t,r){var i,a;if(n.unmount&&n.unmount(e),(i=e.ref)&&(i.current&&i.current!=e.__e||z(i,null,t)),(i=e.__c)!=null){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(e){n.__e(e,t)}i.base=i.__P=i.__n=null}if(i=e.__k)for(a=0;a<i.length;a++)i[a]&&re(i[a],t,r||typeof e.type!=`function`);r||b(e.__e),e.__c=e.__=e.__e=void 0}function ie(e,t,n){return this.constructor(e,n)}function ae(e,r,i){var a,o,s,c;r==document&&(r=document.documentElement),n.__&&n.__(e,r),o=(a=typeof i==`function`)?null:i&&i.__k||r.__k,s=[],c=[],L(r,e=(!a&&i||r).__k=x(C,null,[e]),o||h,h,r.namespaceURI,!a&&i?[i]:o?null:r.firstChild?t.call(r.childNodes):null,s,!a&&i?i:o?o.__e:r.firstChild,a,c),ee(s,e,c),e.props.children=null}t=g.slice,n={__e:function(e,t,n,r){for(var i,a,o;t=t.__;)if((i=t.__c)&&!i.__)try{if((a=i.constructor)&&a.getDerivedStateFromError!=null&&(i.setState(a.getDerivedStateFromError(e)),o=i.__d),i.componentDidCatch!=null&&(i.componentDidCatch(e,r||{}),o=i.__d),o)return i.__E=i}catch(t){e=t}throw e}},r=0,w.prototype.setState=function(e,t){var n=this.__s!=null&&this.__s!=this.state?this.__s:this.__s=y({},this.state);typeof e==`function`&&(e=e(y({},n),this.props)),e&&y(n,e),e!=null&&this.__v&&(t&&this._sb.push(t),O(this))},w.prototype.forceUpdate=function(e){this.__v&&(this.__e=!0,e&&this.__h.push(e),O(this))},w.prototype.render=C,i=[],o=typeof Promise==`function`?Promise.prototype.then.bind(Promise.resolve()):setTimeout,s=function(e,t){return e.__v.__b-t.__v.__b},k.__r=0,c=Math.random().toString(8),l=`__d`+c,u=`__a`+c,d=/(PointerCapture)$|Capture$/i,f=0,p=I(!1),m=I(!0);var B,V,H,oe,U=0,se=[],W=n,G=W.__b,K=W.__r,ce=W.diffed,le=W.__c,ue=W.unmount,de=W.__;function q(e,t){W.__h&&W.__h(V,e,U||t),U=0;var n=V.__H||(V.__H={__:[],__h:[]});return e>=n.__.length&&n.__.push({}),n.__[e]}function J(e){return U=1,fe(be,e)}function fe(e,t,n){var r=q(B++,2);if(r.t=e,!r.__c&&(r.__=[n?n(t):be(void 0,t),function(e){var t=r.__N?r.__N[0]:r.__[0],n=r.t(t,e);t!==n&&(r.__N=[n,r.__[1]],r.__c.setState({}))}],r.__c=V,!V.__f)){var i=function(e,t,n){if(!r.__c.__H)return!0;var i=!1,o=r.__c.props!==e;if(r.__c.__H.__.some(function(e){if(e.__N){i=!0;var t=e.__[0];e.__=e.__N,e.__N=void 0,t!==e.__[0]&&(o=!0)}}),a){var s=a.call(this,e,t,n);return i?s||o:s}return!i||o};V.__f=!0;var a=V.shouldComponentUpdate,o=V.componentWillUpdate;V.componentWillUpdate=function(e,t,n){if(this.__e){var r=a;a=void 0,i(e,t,n),a=r}o&&o.call(this,e,t,n)},V.shouldComponentUpdate=i}return r.__N||r.__}function pe(e,t){var n=q(B++,3);!W.__s&&ye(n.__H,t)&&(n.__=e,n.u=t,V.__H.__h.push(n))}function me(e){return U=5,he(function(){return{current:e}},[])}function he(e,t){var n=q(B++,7);return ye(n.__H,t)&&(n.__=e(),n.__H=t,n.__h=e),n.__}function ge(){for(var e;e=se.shift();){var t=e.__H;if(e.__P&&t)try{t.__h.some(Y),t.__h.some(X),t.__h=[]}catch(n){t.__h=[],W.__e(n,e.__v)}}}W.__b=function(e){V=null,G&&G(e)},W.__=function(e,t){e&&t.__k&&t.__k.__m&&(e.__m=t.__k.__m),de&&de(e,t)},W.__r=function(e){K&&K(e),B=0;var t=(V=e.__c).__H;t&&(H===V?(t.__h=[],V.__h=[],t.__.some(function(e){e.__N&&(e.__=e.__N),e.u=e.__N=void 0})):(t.__h.some(Y),t.__h.some(X),t.__h=[],B=0)),H=V},W.diffed=function(e){ce&&ce(e);var t=e.__c;t&&t.__H&&(t.__H.__h.length&&(se.push(t)!==1&&oe===W.requestAnimationFrame||((oe=W.requestAnimationFrame)||ve)(ge)),t.__H.__.some(function(e){e.u&&=(e.__H=e.u,void 0)})),H=V=null},W.__c=function(e,t){t.some(function(e){try{e.__h.some(Y),e.__h=e.__h.filter(function(e){return!e.__||X(e)})}catch(n){t.some(function(e){e.__h&&=[]}),t=[],W.__e(n,e.__v)}}),le&&le(e,t)},W.unmount=function(e){ue&&ue(e);var t,n=e.__c;n&&n.__H&&(n.__H.__.some(function(e){try{Y(e)}catch(e){t=e}}),n.__H=void 0,t&&W.__e(t,n.__v))};var _e=typeof requestAnimationFrame==`function`;function ve(e){var t,n=function(){clearTimeout(r),_e&&cancelAnimationFrame(t),setTimeout(e)},r=setTimeout(n,35);_e&&(t=requestAnimationFrame(n))}function Y(e){var t=V,n=e.__c;typeof n==`function`&&(e.__c=void 0,n()),V=t}function X(e){var t=V;e.__c=e.__(),V=t}function ye(e,t){return!e||e.length!==t.length||t.some(function(t,n){return t!==e[n]})}function be(e,t){return typeof t==`function`?t(e):t}var xe=2e4,Se=e=>Math.round(e*100)/100,Ce=e=>Math.round(e*1e5)/1e5;function we(e){let t=Number(e);return!Number.isFinite(t)||t<1?1:t>2e4?xe:Math.round(t)}function Te(e){let t=Number(e);return!Number.isFinite(t)||t<=0?0:t>2?2:Ce(t)}function Ee(e,t){return Se(we(e)*Te(t))}function De(e,t,n){if(!(e>0))return 0;let r=Number(t),i=Number(n),a=e*(Number.isFinite(r)&&r>0?r:0);return Se(Math.max(Number.isFinite(i)&&i>0?i:0,a))}function Oe(e,t,n){let r=we(e),i=Te(t.co2e_per_km_kg),a=Ee(r,i);return{distance_km:r,vehicle_class_code:t.class_code,co2e_per_km_kg:i,estimated_co2e_kg:a,amount:De(a,n.price_per_kg_co2e,n.min_contribution_amount),currency:n.currency,factor_source:t.factor_source,factor_country:t.factor_country,factor_year:t.factor_year,factor_scope:t.factor_scope,is_estimated:!0,computed_by:`server`}}var ke={tr:{heading:`Yolculuğunun karbon etkisini dengele`,subheading:e=>`${e} ile birlikte bir iklim katkısı tercihi.`,vehicleLabel:`Araç tipi`,distanceLabel:`Tahmini yolculuk mesafesi`,distanceUnit:`km`,impactLabel:`Tahmini karbon etkisi`,formula:(e,t)=>`${e} km × ${t} kg CO₂e/km`,checkboxLabel:`Bu katkıyı tercih ediyorum`,totalLabel:`Toplam katkı`,addButton:`Tercihimi kaydet`,confirmation:`Tercihinizi kaydettik. Kiralamanıza henüz herhangi bir ücret eklenmedi.`,previewBadge:`Önizleme`,impactLine:(e,t)=>`Bu ay bu şirkette tahmini ≈ ${e} kg CO₂e (≈ ${t} ağaç-yılı)`,minApplied:e=>`En düşük katkı tutarı uygulandı (${e}).`},en:{heading:`Offset your trip’s carbon impact`,subheading:e=>`A climate contribution preference with ${e}.`,vehicleLabel:`Vehicle type`,distanceLabel:`Estimated trip distance`,distanceUnit:`km`,impactLabel:`Estimated carbon impact`,formula:(e,t)=>`${e} km × ${t} kg CO₂e/km`,checkboxLabel:`I would like to make this contribution`,totalLabel:`Total contribution`,addButton:`Save my preference`,confirmation:`Your preference has been recorded. No charge has been added to your rental.`,previewBadge:`Preview`,impactLine:(e,t)=>`This month, estimated ≈ ${e} kg CO₂e at this company (≈ ${t} tree-years)`,minApplied:e=>`Minimum contribution amount applied (${e}).`}};function Ae(e,t){let n=ke[e],r=t?.[e];return r?{...n,heading:r.heading||n.heading,checkboxLabel:r.checkboxLabel||n.checkboxLabel,addButton:r.addButton||n.addButton,confirmation:r.confirmation||n.confirmation}:n}var je=0;Array.isArray;function Z(e,t,r,i,a,o){t||={};var s,c,l=t;if(`ref`in l)for(c in l={},t)c==`ref`?s=t[c]:l[c]=t[c];var u={type:e,props:l,key:r,ref:s,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:--je,__i:-1,__u:0,__source:a,__self:o};if(typeof e==`function`&&(s=e.defaultProps))for(c in s)l[c]===void 0&&(l[c]=s[c]);return n.vnode&&n.vnode(u),u}var Q=1,Me=2e4;function Ne(){return Z(`svg`,{viewBox:`0 0 24 24`,fill:`none`,"aria-hidden":`true`,children:Z(`path`,{d:`M20 6L9 17l-5-5`,stroke:`currentColor`,"stroke-width":`3`,"stroke-linecap":`round`,"stroke-linejoin":`round`})})}function Pe(){return Z(`svg`,{class:`leaf`,viewBox:`0 0 24 24`,fill:`none`,"aria-hidden":`true`,children:[Z(`path`,{d:`M4 20c0-8 6-14 16-14 0 10-6 14-14 14`,stroke:`currentColor`,"stroke-width":`2`,"stroke-linecap":`round`,"stroke-linejoin":`round`}),Z(`path`,{d:`M8 16c3-3 6-4.5 9-5`,stroke:`currentColor`,"stroke-width":`2`,"stroke-linecap":`round`})]})}var Fe=/^#[0-9a-fA-F]{6}$/;function Ie(e){return e&&Fe.test(e)?`--gg-accent:${e}`:void 0}function Le(e){if(!e)return null;try{return new URL(e).protocol===`https:`?e:null}catch{return null}}function Re(e,t,n){let r=n===`tr`?`tr-TR`:`en-GB`;try{return new Intl.NumberFormat(r,{style:`currency`,currency:t,minimumFractionDigits:0,maximumFractionDigits:2}).format(e)}catch{return`${e} ${t}`}}function ze({config:e,initialDistanceKm:t,initialVehicleCode:n,lang:r,onVehicleChange:i,onSelect:a,onAdd:o,preview:s,impact:c}){let l=Ae(r,e.content_overrides),u=r===`tr`?`tr-TR`:`en-GB`,d=e.vehicle_classes,[f,p]=J(()=>d.find(e=>e.class_code===n)?.class_code??d[0]?.class_code??``),[m,h]=J(()=>String($(t))),[g,_]=J(!1),[v,y]=J(!1),b=me({km:t,code:n});pe(()=>{let e=b.current;if(e.km!==t||e.code!==n){if(b.current={km:t,code:n},e.km!==t&&h(String($(t))),e.code!==n){let e=d.find(e=>e.class_code===n);e&&p(e.class_code)}y(!1)}},[t,n,d]);let x=d.find(e=>e.class_code===f),S=$(Number(m)),C=he(()=>{if(!x)return null;let t={class_code:x.class_code,co2e_per_km_kg:x.co2e_per_km_kg,factor_source:x.factor_source,factor_country:x.factor_country,factor_year:x.factor_year,factor_scope:x.factor_scope};return Oe(S,t,{price_per_kg_co2e:e.price_per_kg_co2e,min_contribution_amount:e.min_contribution_amount,currency:e.currency})},[x,S,e]);if(!x||!C)return null;let w=t=>Re(t,e.currency,r),T=(e,t=0)=>e.toLocaleString(u,{minimumFractionDigits:t,maximumFractionDigits:t}),E={distance_km:S,vehicle_class_code:x.class_code},D=C.estimated_co2e_kg*e.price_per_kg_co2e,O=C.amount>0&&D<e.min_contribution_amount,k=e=>{let t=e.currentTarget.value;p(t),i(t)},A=e=>{let t=e.currentTarget.checked;_(t),t&&a(E)},j=()=>{g&&!v&&(o(E),y(!0))},M=!!e.show_estimated_impact&&!!c&&c.estimated_co2e_kg>0;return Z(`div`,{class:`card`,part:`card`,style:Ie(e.brand_color),children:[s&&Z(`span`,{class:`preview-badge`,children:l.previewBadge}),Z(`p`,{class:`kicker`,children:[Le(e.logo_url)?Z(`img`,{class:`logo`,src:Le(e.logo_url),alt:``}):Z(Pe,{}),Z(`span`,{children:e.company_name})]}),Z(`h2`,{class:`heading`,children:l.heading}),Z(`p`,{class:`copy`,children:l.subheading(e.company_name)}),Z(`div`,{class:`orbit`,role:`group`,"aria-label":l.impactLabel,children:[Z(`span`,{class:`orbit-label`,children:l.impactLabel}),Z(`strong`,{class:`orbit-value`,"aria-live":`polite`,children:T(C.estimated_co2e_kg,1)}),Z(`small`,{class:`orbit-unit`,children:`kg CO₂e`})]}),Z(`div`,{class:`calculation`,children:[Z(`p`,{class:`formula`,children:l.formula(T(S),T(x.co2e_per_km_kg,3))}),Z(`div`,{class:`fields`,children:[Z(`label`,{class:`field`,children:[Z(`span`,{children:l.vehicleLabel}),Z(`select`,{value:f,disabled:v,onChange:k,children:d.map(e=>Z(`option`,{value:e.class_code,children:r===`tr`?e.label_tr:e.label_en},e.class_code))})]}),Z(`label`,{class:`field distance`,children:[Z(`span`,{children:l.distanceLabel}),Z(`input`,{type:`number`,inputMode:`numeric`,min:Q,max:Me,step:`1`,value:m,disabled:v,onInput:e=>h(e.currentTarget.value)}),Z(`span`,{class:`unit`,children:l.distanceUnit})]})]})]}),!v&&Z(`label`,{class:`contribution`,children:[Z(`span`,{children:[Z(`b`,{children:l.checkboxLabel}),Z(`span`,{class:`amount`,children:[`+ `,w(C.amount)]})]}),Z(`input`,{type:`checkbox`,checked:g,onChange:A}),Z(`i`,{class:`switch`,"aria-hidden":`true`})]}),O&&!v&&Z(`p`,{class:`note`,children:l.minApplied(w(e.min_contribution_amount))}),!v&&Z(`button`,{type:`button`,class:`primary`,disabled:!g,onClick:j,children:[Z(`span`,{children:l.addButton}),Z(`span`,{class:`arrow`,"aria-hidden":`true`,children:`→`})]}),v&&Z(`div`,{class:`confirm`,role:`status`,"aria-live":`polite`,children:[Z(`span`,{class:`check`,children:Z(Ne,{})}),Z(`span`,{children:l.confirmation})]}),M&&c&&Z(`p`,{class:`impact-line`,children:l.impactLine(T(c.estimated_co2e_kg,1),T(c.tree_equivalent,1))})]})}function $(e){return Number.isFinite(e)?Math.min(Me,Math.max(Q,Math.round(e))):Q}var Be=`
:host {
  all: initial;
  display: block;
  contain: content;
  container-type: inline-size;

  /* Maket paleti (greengold-wheels-mvp/style.css :root) */
  --gg-ink: #06261d;
  --gg-lime: #b9df38;
  --gg-line: #dce2dc;
  --gg-muted: #748079;
  /* Marka aksanı — şirketin brand_color'ı (doğrulanmış hex) override eder.
     Varsayılanı ink: aksan rengi butonun/zeminin rengidir, limon sabit kalır. */
  --gg-accent: var(--gg-ink);

  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.5;
  color: var(--gg-ink);
}
*, *::before, *::after { box-sizing: border-box; }

.card {
  width: 100%;
  max-width: 560px;
  background: linear-gradient(160deg, #f9fbf5 40%, #eff5dc);
  border: 1px solid var(--gg-line);
  border-radius: 20px;
  padding: 22px;
  position: relative;
  font-size: 14px;
}

.preview-badge {
  position: absolute; top: 14px; right: 14px;
  font-size: 10px; font-weight: 800; letter-spacing: .1em;
  text-transform: uppercase;
  color: #4a5c53; background: rgba(255,255,255,.85);
  border: 1px solid var(--gg-line);
  padding: 3px 9px; border-radius: 999px;
  white-space: nowrap;
}

/* --- Başlık --------------------------------------------------------------- */
.kicker {
  display: flex; align-items: center; gap: 8px;
  font-size: .65rem; font-weight: 900; letter-spacing: .15em;
  color: #698078; margin: 0 0 7px; text-transform: uppercase;
}
.kicker .logo { width: 18px; height: 18px; object-fit: contain; border-radius: 4px; }
.kicker .leaf { width: 16px; height: 16px; color: var(--gg-accent); flex: 0 0 auto; }

h2.heading {
  font: 700 1.65rem/1.05 Georgia, "Times New Roman", serif;
  margin: 0 0 10px;
  letter-spacing: -.02em;
  color: var(--gg-ink);
}
.copy { color: #64746d; font-size: .86rem; line-height: 1.5; margin: 0; }

/* --- Dairesel tahmini etki (maketteki .impact-orbit) ----------------------- */
.orbit {
  height: 174px; width: 174px;
  border: 1px solid #cada93; border-radius: 50%;
  margin: 20px auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative;
  background: rgba(255,255,255,.7);
  box-shadow: 0 0 0 12px rgba(185, 223, 56, .08);
}
.orbit::after {
  content: ""; position: absolute; right: 8px; top: 25px;
  width: 16px; height: 16px; background: var(--gg-lime); border-radius: 50%;
}
.orbit .orbit-label {
  font-size: .58rem; letter-spacing: .13em; color: var(--gg-muted); font-weight: 800;
  text-transform: uppercase;
}
.orbit .orbit-value {
  font: 700 2.9rem/1 Georgia, "Times New Roman", serif;
  font-variant-numeric: tabular-nums;
}
.orbit .orbit-unit { font-size: .75rem; color: #4a5c53; }

/* --- Hesap: formül + girdiler --------------------------------------------- */
.calculation { display: grid; gap: 10px; }
.formula {
  font-size: .7rem; text-align: center; color: #6f7c76;
  font-variant-numeric: tabular-nums; margin: 0;
}
.fields { display: grid; gap: 10px; grid-template-columns: 1fr 128px; }
.field { display: grid; gap: 6px; font-size: .7rem; font-weight: 800; }
.field > span { color: #4a5c53; letter-spacing: .02em; }
.field select, .field input {
  width: 100%; padding: 12px;
  border: 1px solid var(--gg-line); background: #fff; border-radius: 10px;
  font: 600 .9rem inherit; color: var(--gg-ink);
  appearance: none;
}
.field select {
  /* Yerel ok yerine tek tip bir chevron (tüm tarayıcılarda aynı görünür). */
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2306261d' stroke-width='2.4' stroke-linecap='round'><path d='M6 9l6 6 6-6'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 14px;
  padding-right: 32px;
}
.field select:focus-visible, .field input:focus-visible {
  outline: 3px solid rgba(185, 223, 56, .55); outline-offset: 1px;
  border-color: var(--gg-accent);
}
.distance { position: relative; }
.distance input { padding-right: 36px; }
.distance .unit {
  position: absolute; right: 12px; bottom: 13px;
  font-size: .78rem; color: var(--gg-muted); pointer-events: none;
}

/* --- Katkı (maketteki .contribution toggle) -------------------------------- */
.contribution {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: #fff;
  border: 1.5px solid var(--gg-lime);
  border-radius: 14px;
  padding: 14px;
  margin-top: 13px;
  cursor: pointer;
}
.contribution > span { display: grid; gap: 4px; }
.contribution b { font-size: .8rem; }
.contribution .amount {
  color: #658000; font-weight: 850; font-size: .82rem;
  font-variant-numeric: tabular-nums;
}
.contribution input { position: absolute; opacity: 0; width: 0; height: 0; }
.contribution .switch {
  flex: 0 0 auto;
  width: 42px; height: 24px; background: #dbe1dc; border-radius: 99px;
  position: relative; transition: background .2s ease;
}
.contribution .switch::after {
  content: ""; position: absolute;
  width: 18px; height: 18px; left: 3px; top: 3px;
  background: #fff; border-radius: 50%;
  box-shadow: 0 1px 5px #839089;
  transition: transform .2s ease, background .2s ease;
}
.contribution input:checked + .switch { background: var(--gg-lime); }
.contribution input:checked + .switch::after {
  transform: translateX(18px); background: var(--gg-ink);
}
.contribution input:focus-visible + .switch {
  outline: 3px solid rgba(185, 223, 56, .55); outline-offset: 2px;
}
.contribution.disabled { opacity: .55; cursor: not-allowed; border-color: var(--gg-line); }

/* --- Buton ---------------------------------------------------------------- */
.primary {
  width: 100%; border: 0; border-radius: 12px;
  background: var(--gg-accent); color: #fff;
  padding: 14px 16px;
  font: 850 .92rem inherit;
  margin-top: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  transition: filter .15s ease;
}
.primary:hover:not(:disabled) { filter: brightness(1.18); }
.primary:focus-visible { outline: 3px solid rgba(185, 223, 56, .6); outline-offset: 2px; }
.primary:disabled { background: #cfd6d1; color: #88938e; cursor: not-allowed; }
.primary .arrow { font-size: 1.05rem; line-height: 1; }

/* --- Notlar / onay -------------------------------------------------------- */
.note { font-size: .68rem; color: #7e8b85; margin: 10px 0 0; text-align: center; }

.confirm {
  margin-top: 14px;
  display: flex; align-items: flex-start; gap: 10px;
  padding: 13px; border-radius: 14px;
  background: #fff; border: 1.5px solid var(--gg-lime);
  color: var(--gg-ink); font-size: .82rem;
}
.confirm .check {
  flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%;
  background: var(--gg-lime); display: grid; place-items: center;
}
.confirm .check svg { width: 13px; height: 13px; color: var(--gg-ink); }

.impact-line {
  margin: 12px 0 0; padding-top: 11px;
  border-top: 1px solid var(--gg-line);
  font-size: .7rem; color: #5f6f68;
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center;
}

@media (prefers-reduced-motion: reduce) {
  .primary, .contribution .switch, .contribution .switch::after { transition: none; }
}

/* Dar kapsayıcıda (telefon ya da dar kolon) tek sütuna düş. */
@container (max-width: 420px) {
  .card { padding: 18px; }
  .fields { grid-template-columns: 1fr; }
  .orbit { height: 150px; width: 150px; }
  .orbit .orbit-value { font-size: 2.4rem; }
}
`;async function Ve(e,t){try{let n=await fetch(`${e}/widget/config?key=${encodeURIComponent(t)}`);if(!n.ok)return null;let r=await n.json();return!r.success||!r.data||!Array.isArray(r.data.vehicle_classes)?null:r.data}catch{return null}}async function He(e,t){try{let n=await fetch(`${e}/widget/impact?key=${encodeURIComponent(t)}`);if(!n.ok)return null;let r=await n.json();return!r.success||!r.data?null:r.data}catch{return null}}function Ue(e,t,n,r,i){try{fetch(`${e}/widget/events`,{method:`POST`,headers:{"Content-Type":`application/json`,"X-Widget-Key":t},body:JSON.stringify({event_type:n,session_ref:r,...Object.keys(i).length>0?{metadata:i}:{}}),keepalive:!0}).catch(()=>{})}catch{}}var We=`http://localhost:3000`,Ge=`green-gold-wheels-widget`,Ke=1,qe=2e4,Je=100,Ye=`greengold_wheels_journey_id`;function Xe(e){let t=Number(e);return Number.isFinite(t)?Math.min(qe,Math.max(Ke,Math.round(t))):100}function Ze(e){return e===`en`?`en`:`tr`}function Qe(){return typeof crypto<`u`&&`randomUUID`in crypto?crypto.randomUUID():`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g,e=>{let t=Math.random()*16|0;return(e===`x`?t:t&3|8).toString(16)})}function $e(e){let t=e?.trim();if(t&&t.length<=Je)return t;try{let e=window.sessionStorage.getItem(Ye);if(e)return e;let t=Qe();return window.sessionStorage.setItem(Ye,t),t}catch{return Qe()}}var et=class e extends HTMLElement{static get observedAttributes(){return[`data-distance-km`,`data-vehicle-class`,`data-lang`]}mount;config=null;impact=null;sessionRef=``;key=``;apiBase=We;preview=!1;trackerOnly=!1;sentEvents=new Set;async connectedCallback(){if(this.key=this.getAttribute(`data-key`)??``,this.key&&(this.apiBase=this.getAttribute(`data-api`)??We,this.preview=this.getAttribute(`data-preview`)===`true`,this.trackerOnly=this.getAttribute(`data-tracker-only`)===`true`,this.sessionRef||=$e(this.getAttribute(`data-journey-id`)),!this.trackerOnly)){if(this.shadowRoot)this.mount||=this.shadowRoot.querySelector(`div`)??void 0;else{let e=this.attachShadow({mode:`open`}),t=document.createElement(`style`);t.textContent=Be,this.mount=document.createElement(`div`),e.append(t,this.mount)}if(!this.config){let e=await Ve(this.apiBase,this.key);if(!e||e.vehicle_classes.length===0)return;this.config=e}this.rerender(),this.sendOnce(`widget_goruntulendi`,{distance_km:this.distanceKm(),vehicle_class_code:this.initialVehicleCode()}),this.loadImpact()}}async loadImpact(){if(this.impact)return;let e=await He(this.apiBase,this.key);e&&(this.impact=e,this.rerender())}sendOnce(e,t){if(this.preview||this.sentEvents.has(e))return;this.sentEvents.add(e);let n={};typeof t.distance_km==`number`&&(n.distance_km=t.distance_km),t.vehicle_class_code&&(n.vehicle_class_code=t.vehicle_class_code),Ue(this.apiBase,this.key,e,this.sessionRef,n)}attributeChangedCallback(t){e.observedAttributes.includes(t)&&this.config&&this.mount&&this.rerender()}disconnectedCallback(){this.mount&&ae(null,this.mount)}distanceKm(){return Xe(this.getAttribute(`data-distance-km`))}initialVehicleCode(){return this.getAttribute(`data-vehicle-class`)??void 0}rerender(){this.config&&this.mount&&ae(Z(ze,{config:this.config,initialDistanceKm:this.distanceKm(),initialVehicleCode:this.initialVehicleCode(),lang:Ze(this.getAttribute(`data-lang`)),onVehicleChange:e=>this.sendOnce(`arac_secildi`,{vehicle_class_code:e}),onSelect:e=>this.sendOnce(`checkbox_secildi`,e),onAdd:e=>this.handleAdd(e),preview:this.preview,impact:this.impact}),this.mount)}handleAdd(e){this.sendOnce(`katki_ekle_butonuna_basildi`,e),this.dispatchEvent(new CustomEvent(`greengold:contribution-selected`,{bubbles:!0,composed:!0,detail:{session_ref:this.sessionRef,distance_km:e.distance_km,vehicle_class_code:e.vehicle_class_code,currency:this.config?.currency??null}}))}trackBookingContinue(){this.key&&this.sendOnce(`rezervasyona_devam_edildi`,{})}};return customElements.get(Ge)||customElements.define(Ge,et),e.GreenGoldWheelsWidget=et,e})({});