<script setup lang="ts">
import { Form } from "@adonisjs/inertia/vue";
</script>

<template>
  <Guest title="Login" description="Enter your details below to login to your account">
    <Form
      v-slot="{ processing, errors }"
      route="session.store"
      class="space-y-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl bg-muted"
    >
      <div class="grid gap-2">
        <label for="email" class="text-sm font-medium text-muted-foreground">Email</label>
        <input
          id="email"
          type="email"
          name="email"
          placeholder="Enter your email"
          autocomplete="username"
          :data-invalid="errors.email ? 'true' : undefined"
          class="bg-input"
        />
        <div v-if="errors.email">{{ errors.email }}</div>
      </div>

      <div class="grid gap-2">
        <label for="password" class="text-sm font-medium text-muted-foreground"
          >Password</label
        >
        <input
          id="password"
          type="password"
          name="password"
          placeholder="Enter your password"
          autocomplete="current-password"
          :data-invalid="errors.password ? 'true' : undefined"
          class="bg-input"
        />
        <div v-if="errors.password">{{ errors.password }}</div>
      </div>

      <div>
        <button
          type="submit"
          class="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="processing"
        >
          {{ processing ? "Logging in..." : "Login" }}
        </button>
      </div>
    </Form>
  </Guest>
</template>
