import { useState } from "react"
import { createCompany } from "../../api/companies"
import { toast } from "react-hot-toast"

type Props = {
  refresh: () => Promise<void>
}

const AddCompany = ({ refresh }: Props) => {
  const [ newCompany, setNewCompany ] = useState<string>("")

  const saveCompany = async () => {
    const companyName = newCompany.trim()
    if (companyName.length < 3) return toast.error("Company name must be at least 3 characters.")
    const response = await createCompany(companyName)
    if (!response.success) return toast.error("Unable to create company.")
    refresh()
    setNewCompany("")
  }

  return (
    <div className="add-company">
      <input type="text" placeholder={"Add your company"} value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
      <button className="solid" disabled={!newCompany} onClick={saveCompany}>{"Add"}</button>
    </div>
  )
}

export default AddCompany
