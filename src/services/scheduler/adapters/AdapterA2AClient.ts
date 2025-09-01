import axios from 'axios'

export class AdapterA2AClient {
  constructor(private base: string) {
    if (this.base.endsWith('/')) this.base = this.base.slice(0, -1)
  }
  private endpoint(path: string) { return `${this.base}${path}` }

  async invoke(message: any, token?: string) {
    const r = await axios.post(this.endpoint('/invoke'), message, { headers: this.h(token) })
    return r.data
  }
  async message(args: { target: { agent: string }, channel?: string, text: string, metadata?: any }, token?: string) {
    const r = await axios.post(this.endpoint('/sendMessage'), args, { headers: this.h(token) })
    return r.data
  }
  async createTask(args: { target: { agent: string }, title?: string, params?: any }, token?: string) {
    const r = await axios.post(this.endpoint('/tasks/create'), args, { headers: this.h(token) })
    return r.data
  }
  async getTask(args: { target: { agent: string }, id: string }, token?: string) {
    const r = await axios.post(this.endpoint('/tasks/get'), args, { headers: this.h(token) })
    return r.data
  }
  async listTasks(args: { target: { agent: string }, filter?: string, options?: any }, token?: string) {
    const r = await axios.post(this.endpoint('/tasks/list'), args, { headers: this.h(token) })
    return r.data
  }
  async cancelTask(args: { target: { agent: string }, id: string }, token?: string) {
    const r = await axios.post(this.endpoint('/tasks/cancel'), args, { headers: this.h(token) })
    return r.data
  }
  private h(token?: string) { return token ? { Authorization: `Bearer ${token}` } : {} }
}

