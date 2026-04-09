import {useEffect,useState} from 'react'
import {useParams} from 'react-router-dom'
import api from '../../api'

export default function AdminTicketTypes(){

const {id}=useParams()

const [tickets,setTickets]=useState([])
const [form,setForm]=useState({
  name:'',
  price_pesos:'',
  stock_total:'',
  sales_start_at:'',
  sales_end_at:''
})

async function load(){

  const res = await api.get(`/events/${id}/ticket-types`)
  setTickets(res.data)

}

useEffect(()=>{load()},[])

async function create(){

  await api.post(`/events/${id}/ticket-types`,{
    ...form,
    price_cents:Math.round(form.price_pesos*100)
  })

  setForm({
    name:'',
    price_pesos:'',
    stock_total:'',
    sales_start_at:'',
    sales_end_at:''
  })

  load()

}

return(

<div>

<h2>Ticket Types</h2>

<table>

<thead>
<tr>
<th>Nombre</th>
<th>Precio</th>
<th>Stock</th>
<th>Inicio</th>
<th>Fin</th>
<th>Estado</th>
</tr>
</thead>

<tbody>

{tickets.map(t=>(
<tr key={t.id}>

<td>{t.name}</td>

<td>${t.price_pesos}</td>

<td>{t.stock_total - t.stock_sold}/{t.stock_total}</td>

<td>{t.sales_start_at}</td>

<td>{t.sales_end_at}</td>

<td>{t.state}</td>

</tr>
))}

</tbody>

</table>

<h3>Nuevo Ticket</h3>

<input
placeholder="Nombre"
value={form.name}
onChange={e=>setForm({...form,name:e.target.value})}
/>

<input
placeholder="Precio"
value={form.price_pesos}
onChange={e=>setForm({...form,price_pesos:e.target.value})}
/>

<input
placeholder="Stock"
value={form.stock_total}
onChange={e=>setForm({...form,stock_total:e.target.value})}
/>

<input
type="datetime-local"
value={form.sales_start_at}
onChange={e=>setForm({...form,sales_start_at:e.target.value})}
/>

<input
type="datetime-local"
value={form.sales_end_at}
onChange={e=>setForm({...form,sales_end_at:e.target.value})}
/>

<button onClick={create}>
Crear ticket
</button>

</div>

)

}