document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#secret-password-form");
  const input = document.querySelector("#secret-password");
  const feedback = document.querySelector("#secret-password-feedback");

  if (!form || !input || !feedback) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (input.value.trim() === "shit") {
      window.location.href = "super.html";
      return;
    }

    const language = localStorage.getItem("siteLanguage") || "pl";
    feedback.textContent = translations[language]?.secretPasswordWrong
      || translations.pl.secretPasswordWrong;
    input.select();
  });
});
