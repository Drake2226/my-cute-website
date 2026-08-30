<template>
  <div class="cabinet">
    <div class="console">
      <span class="console__screw console__screw--tl" aria-hidden="true" />
      <span class="console__screw console__screw--tr" aria-hidden="true" />
      <span class="console__screw console__screw--bl" aria-hidden="true" />
      <span class="console__screw console__screw--br" aria-hidden="true" />

      <p class="console__plate">♡ LOVE-MACHINE 3000 ♡</p>

      <div class="screen lost">
        <div class="lost__body">
          <p class="eyebrow">ERROR 404</p>
          <h1 class="headline">This level does not exist</h1>
          <p class="subline">Wrong cartridge. The date is back at the start.</p>
          <router-link to="/" class="btn btn--yes lost__btn">Take me home 💗</router-link>
        </div>
        <div class="screen__glass" aria-hidden="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.lost {
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
}

.lost__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.lost__btn {
  margin-top: 18px;
  text-decoration: none;
  display: inline-block;
}
</style>
