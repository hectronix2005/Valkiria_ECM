import{j as r}from"./vendor-query-BtlmzfbD.js";import{a2 as c}from"./vendor-icons-BXQn8V43.js";const u={primary:"bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500",secondary:"bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500",success:"bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",danger:"bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",ghost:"text-gray-600 hover:bg-gray-100 focus:ring-gray-500",outline:"border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500"},y={sm:"px-3 py-1.5 text-sm",md:"px-4 py-2",lg:"px-6 py-3 text-lg"};function m({children:t,variant:o="primary",size:a="md",loading:e=!1,disabled:i=!1,icon:s,className:n="",...g}){return r.jsxs("button",{className:`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${u[o]}
        ${y[a]}
        ${n}
      `,disabled:i||e,...g,children:[e?r.jsx(c,{className:"w-4 h-4 animate-spin"}):s?r.jsx(s,{className:"w-4 h-4"}):null,t]})}export{m as B};
