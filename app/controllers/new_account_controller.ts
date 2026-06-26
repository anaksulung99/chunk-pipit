import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import Env from '#start/env'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store({ request, response, auth, session }: HttpContext) {
    const enableRegister = Env.get('ENABLE_REGISTER')
    if (!enableRegister) {
      session.flash('error', 'Registration is disabled')
      return response.redirect().toRoute('home')
    }

    const payload = await request.validateUsing(signupValidator)
    const user = await User.create({ ...payload })

    await auth.use('web').login(user)
    session.flash('success', 'Registration successful')
    return response.redirect().toRoute('home')
  }
}
