import { useState } from "react"
import { toast } from "react-hot-toast"
import { Search as SearchIcon } from "@carbon/icons-react"
import { useNavigate } from "react-router-dom"

const Search = () => {
  const [ searchValue, setSearchValue ] = useState<string>("")
  const navigate = useNavigate()

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value)
  }

  const onClick = () => {
    const ticketId = searchValue.trim()
    if (!ticketId) return toast.error("Please enter a ticket ID first.")
    navigate(`/tickets/${ticketId}`)
  }

  return (
    <div className="search">
    <input value={searchValue} onChange={onChange} type="text" name="search" placeholder={"Search by Id"} />
    <button className="solid" onClick={onClick} aria-label="Search"><SearchIcon /></button>
  </div>
  )
}

export default Search
