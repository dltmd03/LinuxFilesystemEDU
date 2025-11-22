   (function () {
  const sections = document.querySelectorAll("section[data-page]");
  const links = document.querySelectorAll("[data-nav]");
  const mobileToggle = document.getElementById("mobile-menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  // 섹션 보이기/숨기기
  function showOnlyPages(pages) {
    sections.forEach((sec) => {
      if (pages.includes(sec.dataset.page)) {
        sec.classList.remove("hidden");
      } else {
        sec.classList.add("hidden");
      }
    });
  }

  // 헤더 높이를 고려해서 해당 섹션으로 스크롤
  function scrollToId(id, extraOffset = 0) {
    const target = document.getElementById(id);
    if (!target) return;

    const header = document.querySelector("header");
    const headerHeight = header ? header.offsetHeight : 0;
    const rect = target.getBoundingClientRect();
    const offsetTop = rect.top + window.scrollY - headerHeight - 8 + extraOffset;

    window.scrollTo({
      top: offsetTop < 0 ? 0 : offsetTop,
      behavior: "smooth",
    });
  }

  // 공통 페이지 전환 함수
  function showPage(target) {
    let pages;

    if (target === "lab") {
      // 바로 실습만
      pages = ["lab"];
    } else if (!target || target === "home") {
      // 홈만
      pages = ["home"];
    } else {
      // 홈 + (개념/명령어/로드맵/FAQ/커뮤니티)
      pages = ["home", target];
    }

    showOnlyPages(pages);

    // URL 해시 업데이트
    const hash = !target || target === "home" ? "#home" : "#" + target;
    history.replaceState(null, "", hash);

    // 스크롤: 제목이 헤더 바로 아래에 오면서, 실습 터미널과 예시 명령어가 같이 보이도록 lab에는 추가 여유를 줌
    if (target === "lab") {
      scrollToId("lab", 60); // lab일 때는 조금 더 아래로
    } else if (!target || target === "home") {
      scrollToId("home");
    } else {
      scrollToId(target);
    }
  }

  // 🔹 햄버거 버튼: 메뉴 열기/닫기
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener("click", (e) => {
      e.stopPropagation(); // 클릭이 document로 바로 전파돼서 곧바로 닫히는 것 방지
      mobileMenu.classList.toggle("hidden");
    });
  }

  // 🔹 화면 아무 곳이나 클릭하면 메뉴 닫기
  document.addEventListener("click", (event) => {
    if (!mobileMenu || !mobileToggle) return;

    const isMenuOpen = !mobileMenu.classList.contains("hidden");
    if (!isMenuOpen) return;

    const clickedInsideMenu = mobileMenu.contains(event.target);
    const clickedToggle = mobileToggle.contains(event.target);

    // 메뉴가 열려 있고, 메뉴 안도 아니고, 토글 버튼도 아니면 닫기
    if (!clickedInsideMenu && !clickedToggle) {
      mobileMenu.classList.add("hidden");
    }
  });

  // 🔹 상단 nav + 햄버거 메뉴 + 로고: 전부 공통 라우팅
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      const target = link.dataset.nav;
      if (!target) return;

      e.preventDefault();
      showPage(target);

      // 모바일 메뉴에서 클릭했을 경우: 메뉴 닫기
      if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
        mobileMenu.classList.add("hidden");
      }
    });
  });

  // 첫 로드: 홈부터 시작
  showPage("home");
})();