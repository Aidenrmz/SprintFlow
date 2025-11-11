import { Link, Navigate } from "react-router-dom"
import { MobileCheck, CenterSquare, ThumbsUp } from "@carbon/icons-react"
import dashboard from "../../assets/dashboard-preview.png"
import FeatureCard from "./FeatureCard"
import createGoogleUrl from "../../utils/createGoogleUrl"
import useGlobal from "../../hooks/useGlobal"
import { user$ } from "../../states/user"
import { loginDemo } from "../../states/user"
import { token$ } from "../../api/users"
import { useNavigate } from "react-router-dom"
import { toast } from "react-hot-toast"

const Landing = () => {
  const user = useGlobal(user$)
  const token = useGlobal(token$)
  const navigate = useNavigate()
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true"

  const features = [
    { title: "Track anywhere", description: "A responsive workspace keeps ticket creation, updates, and follow-up available on any screen.", icon: <MobileCheck size="32" /> },
    { title: "Team visibility", description: "Company-level queues help administrators review every active request without switching tools.", icon: <CenterSquare size="32" /> },
    { title: "Clear handoffs", description: "Status, priority, messaging, and requester details stay together so the next step is always visible.", icon: <ThumbsUp size="32" /> }
  ]

  if (user && token) return <Navigate to="/dashboard" replace />

  const startDemo = async () => {
    await loginDemo({
      onSuccess: () => navigate("/dashboard"),
      onError: () => toast.error("Unable to start the demo.")
    })
  }

  return (
    <div className="landing wrapper">
      <h1>{"Move support work at "}<span>{"SprintFlow"}</span>{" speed."}</h1>
      <div className="sub">
        <p>{"Track issues, route requests, and keep teams aligned from one focused workspace."}</p>
        <p>{"SprintFlow brings ticket intake, status visibility, messaging, and reporting into a clean workflow."}</p>
      </div>
      <div className="actions">
        { demoMode && <button className="solid" onClick={startDemo}>{"Try Demo"}</button> }
        <Link to={createGoogleUrl()} className={demoMode ? "outline" : "solid"}>{"Start with Google"}</Link>
      </div>
      <img src={dashboard} alt="application dashboard mockup" />
      <h2>{"Built for fast support workflows"}</h2>
      <section className="features">
        { features.map((feature, i) => <FeatureCard key={i} feature={feature} />)}
      </section>
    </div>
  )
}

export default Landing
