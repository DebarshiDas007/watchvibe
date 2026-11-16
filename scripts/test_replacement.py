modal_replacement = '''  <!-- USER PROFILE & AUTHENTICATION MODAL (MIMICORE ARCHITECTURE) -->
  <div id="authModal" class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 hidden flex items-center justify-center p-3 sm:p-5" onclick="if(event.target === this) closeAuthModal();">
    <div class="mimicore-card w-full max-w-[500px] p-6 sm:p-8 relative space-y-5 max-h-[92vh] overflow-y-auto">
      <!-- Modal Header -->
      <div class="flex justify-between items-start pb-1">
        <div>
          <h3 id="authModalHeaderTitle" class="text-xl sm:text-2xl font-black text-white tracking-tight">Sign in or create an account</h3>
          <p id="authModalHeaderSubtitle" class="text-xs text-slate-400 mt-1 leading-relaxed">Free to use. Sync your watchlist across all your devices with zero passwords.</p>
        </div>
        <button onclick="closeAuthModal()" type="button" aria-label="Close modal" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0 ml-2 cursor-pointer">
          <i class="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>

      <!-- 3-Pill Feature Reassurance Row -->
      <div id="authValuePerksRow" class="flex items-center justify-between gap-1.5 py-1.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[10.5px] text-slate-300 font-medium">
        <span class="flex items-center gap-1.5">🍿 <span>Cloud Watchlist</span></span>
        <span class="text-slate-600">·</span>
        <span class="flex items-center gap-1.5">🎯 <span class="text-purple-300">AI Vibe Matcher</span></span>
        <span class="text-slate-600">·</span>
        <span class="flex items-center gap-1.5">⚡ <span class="text-amber-300">Zero Passwords</span></span>
      </div>

      <!-- Logged In Profile State (Visible when session is active) -->
      <div id="authLoggedInState" class="hidden space-y-4 pt-1">
        <div class="bg-white/[0.04] p-4 rounded-2xl border border-purple-500/30 flex items-center gap-3.5 shadow-md">
          <div id="profileUserAvatarBox" class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg shrink-0">
            <i class="fa-solid fa-user"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div id="authActiveUserName" class="text-sm font-black text-white truncate">Vibe Connoisseur</div>
            <div id="authActiveUserEmail" class="text-xs text-slate-400 truncate font-mono">user@gmail.com</div>
            <div class="text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Profile Active & Cloud Synced
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-center text-xs">
          <div class="bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.08]">
            <div class="text-slate-400 text-[10px]">Saved Watchlist</div>
            <div id="profileWatchlistCount" class="text-base font-black text-purple-300">12 Titles</div>
          </div>
          <div class="bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.08]">
            <div class="text-slate-400 text-[10px]">Vibe Persona</div>
            <div class="text-base font-black text-amber-400">Mind Blown</div>
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <button onclick="syncCloudWatchlists()" type="button" class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer">
            <i class="fa-solid fa-cloud-arrow-up"></i> Sync Watchlist Now
          </button>
          <button onclick="userSignOut()" type="button" class="bg-white/[0.06] hover:bg-rose-600/20 text-rose-300 hover:text-white border border-white/10 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer">
            Sign Out
          </button>
        </div>

        <!-- Superadmin Entry Point (STRICTLY INVISIBLE EXCEPT TO dasdebarshi1234@gmail.com) -->
        <div id="adminStudioEntryPoint" class="hidden pt-2 border-t border-white/[0.08]">
          <button onclick="closeAuthModal(); openAdminStudio();" type="button" class="w-full bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-purple-900/80 hover:from-purple-800 hover:to-indigo-800 border border-purple-500/60 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow-xl flex items-center justify-between cursor-pointer group">
            <span class="flex items-center gap-2.5">
              <i class="fa-solid fa-shield-halved text-purple-400 group-hover:scale-110 transition"></i>
              <span class="text-xs font-black text-purple-100">Launch Admin Command Studio</span>
            </span>
            <span class="text-[9px] bg-purple-500/30 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded-full font-mono font-black">SUPERADMIN</span>
          </button>
        </div>
      </div>

      <!-- Logged Out Auth State (Exact Mimicore Stack & Flow) -->
      <div id="authLoggedOutState" class="space-y-4">
        <!-- 3 Primary Mimicore Action Buttons -->
        <div class="space-y-2.5">
          <!-- 1. Google 1-Click Button -->
          <button id="googleSignInBtn" onclick="handleGoogleSignIn()" type="button" class="auth-btn google">
            <svg viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span id="googleSignInLabel" class="text-slate-900">Continue with Google</span>
          </button>

          <!-- 2. Discord Button -->
          <button id="discordSignInBtn" onclick="handleDiscordSignIn()" type="button" class="auth-btn discord">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span>Continue with Discord</span>
          </button>

          <!-- 3. Continue with Email -->
          <button id="emailToggleBtn" onclick="toggleMimiCoreEmailBox()" type="button" class="auth-btn email-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"></rect>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
            </svg>
            <span>Continue with email</span>
          </button>
        </div>

        <!-- Multi-Account Quick Switcher Tray (If saved accounts on device) -->
        <div id="googleMultiAccountsTray" class="hidden pt-1 space-y-1.5">
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between px-1">
            <span>Saved Accounts on this Device</span>
            <span class="text-purple-400 font-mono text-[9px]">Tap to Switch</span>
          </div>
          <div id="googleSavedAccountsList" class="space-y-1.5 max-h-36 overflow-y-auto pr-0.5"></div>
        </div>

        <!-- EXPANDABLE EMAIL BOX (MIMICORE INLINE DRAWER) -->
        <div id="mimicoreEmailBox" class="hidden pt-3 border-t border-white/[0.08] space-y-3.5">
          <form onsubmit="handleMimiCoreEmailSubmit(event)" class="space-y-3">
            <div>
              <label class="block text-slate-300 text-xs font-semibold mb-1.5">Email address</label>
              <input type="email" id="authEmailInput" placeholder="you@example.com" autocomplete="email" required class="mimicore-input">
              
              <!-- 1-Click Domain Quick-Pills -->
              <div class="flex flex-wrap sm:flex-nowrap gap-1.5 mt-2">
                <button type="button" onclick="appendDomainToInput('authEmailInput', '@gmail.com')" class="flex-1 text-[10px] bg-white/[0.04] hover:bg-purple-900/40 text-purple-300 border border-purple-500/30 py-1 rounded-lg transition font-mono text-center cursor-pointer">+ @gmail.com</button>
                <button type="button" onclick="appendDomainToInput('authEmailInput', '@outlook.com')" class="flex-1 text-[10px] bg-white/[0.04] hover:bg-purple-900/40 text-slate-400 border border-white/10 py-1 rounded-lg transition font-mono text-center cursor-pointer">+ @outlook.com</button>
                <button type="button" onclick="appendDomainToInput('authEmailInput', '@yahoo.com')" class="flex-1 text-[10px] bg-white/[0.04] hover:bg-purple-900/40 text-slate-400 border border-white/10 py-1 rounded-lg transition font-mono text-center cursor-pointer">+ @yahoo.com</button>
                <button type="button" onclick="appendDomainToInput('authEmailInput', '@icloud.com')" class="flex-1 text-[10px] bg-white/[0.04] hover:bg-purple-900/40 text-slate-400 border border-white/10 py-1 rounded-lg transition font-mono text-center cursor-pointer">+ @icloud.com</button>
              </div>
            </div>

            <!-- Optional Password Mode Container -->
            <div id="mimicorePasswordField" class="hidden space-y-1">
              <label class="block text-slate-300 text-xs font-semibold mb-1">Password</label>
              <div class="relative">
                <input type="password" id="authPasswordInput" placeholder="Enter your password" class="mimicore-input pr-10">
                <button type="button" onclick="togglePasswordVisibility('authPasswordInput', 'authPasswordEyeIcon')" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition p-1">
                  <i id="authPasswordEyeIcon" class="fa-regular fa-eye text-xs"></i>
                </button>
              </div>
            </div>

            <div id="authErrorMsg" class="hidden text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-xl"></div>

            <!-- Mimicore Vivid Primary Button -->
            <button type="submit" id="authSubmitBtn" class="mimicore-primary-btn">
              <span id="authSubmitBtnLabel">Email me a sign-in link</span>
            </button>

            <!-- Mode Switch Link (Magic Link vs Password) -->
            <div class="text-center pt-1">
              <button type="button" id="mimicorePasswordToggleBtn" onclick="toggleMimiCorePasswordMode()" class="text-xs text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer transition">
                Have a password? Sign in with it
              </button>
            </div>
          </form>
        </div>

        <!-- Footer Reassurance -->
        <div class="pt-3 border-t border-white/[0.06] text-center space-y-2">
          <p class="text-[11px] text-slate-500 leading-relaxed">
            By signing in you agree to the <a href="javascript:void(0)" class="text-slate-400 hover:text-white underline">license</a>, the <a href="javascript:void(0)" class="text-slate-400 hover:text-white underline">acceptable use policy</a> and the <a href="javascript:void(0)" class="text-slate-400 hover:text-white underline">privacy policy</a>.
          </p>
          <div>
            <button type="button" onclick="closeAuthModal()" class="text-xs text-slate-400 hover:text-purple-300 transition inline-flex items-center gap-1.5 font-medium cursor-pointer">
              <i class="fa-solid fa-compass text-[10px] text-purple-400"></i> Continue Browsing as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>'''

print(f"Replacement length: {len(modal_replacement)}")
