import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

class ErrorBoundary extends Component<{children:React.ReactNode},{error:Error|null}>{
  state={error:null as Error|null};
  static getDerivedStateFromError(error:Error){return{error};}
  render(){
    if(this.state.error)return(
      <div style={{padding:40,fontFamily:"monospace",color:"#ff4444",background:"#111",minHeight:"100vh"}}>
        <h1>React Crash</h1>
        <pre style={{whiteSpace:"pre-wrap",marginTop:20}}>{this.state.error.message}</pre>
        <pre style={{whiteSpace:"pre-wrap",marginTop:10,color:"#888",fontSize:12}}>{this.state.error.stack}</pre>
      </div>
    );
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
