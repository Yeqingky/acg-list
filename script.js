// script.js

const container = document.getElementById('image-container');

// API URLs
const apiUrls = [
    'https://api.yppp.net/pc.php?return=all',
    'https://api.yppp.net/pe.php?return=all'
];

let allImageUrls = [];
let currentIndex = 0;
const batchSize = 24; // 每次加载 24 个图片DOM，保证每次能铺满好几排

let colNum = getColNum();
let columns = [];
let imageElements = []; // 存储所有的图片DOM元素，用于响应式重排

// 获取当前屏幕宽度对应的列数
function getColNum() {
    if (window.innerWidth > 1200) return 4;
    if (window.innerWidth > 800) return 3;
    if (window.innerWidth > 500) return 2;
    return 1;
}

// 初始化瀑布流的列（显式Flex列布局解决原生CSS多列的闪屏/回流问题）
function initColumns() {
    container.innerHTML = '';
    columns = [];
    for (let i = 0; i < colNum; i++) {
        const col = document.createElement('div');
        col.classList.add('column');
        container.appendChild(col);
        columns.push(col);
    }
}

// 窗口尺寸改变时，如果列数发生变化，则重新分配图片
window.addEventListener('resize', () => {
    const newColNum = getColNum();
    if (newColNum !== colNum) {
        colNum = newColNum;
        initColumns();
        // 按照轮询的方式将已有元素重新分配到新列中
        imageElements.forEach((el, index) => {
            columns[index % colNum].appendChild(el);
        });
    }
});

// Fetch data from APIs and populate the images
async function fetchImages() {
    try {
        const responses = await Promise.all(apiUrls.map(url => fetch(url)));
        const dataPromises = responses.map(response => response.text());
        const allData = await Promise.all(dataPromises);

        // Split the returned text into image URLs, clean empty lines
        allImageUrls = allData
            .flatMap(data => data.split('\n'))
            .map(url => url.trim())
            .filter(url => url.length > 0);

        // 打乱数组顺序，让多组图片混合显示
        allImageUrls.sort(() => Math.random() - 0.5);

        initColumns(); // 初始化分列

        // 初次只加载部分 DOM
        loadMoreImages();

        // 监听滚动到底部，继续加载更多 DOM
        setupInfiniteScroll();

    } catch (error) {
        console.error('Error fetching images:', error);
    }
}

// 加载更多图片 DOM
function loadMoreImages() {
    if (currentIndex >= allImageUrls.length) {
        // 当数组加载完毕时，重置索引，并再次打乱数组顺序，实现真正的无限滚动
        currentIndex = 0;
        allImageUrls.sort(() => Math.random() - 0.5);
    }

    const endIndex = Math.min(currentIndex + batchSize, allImageUrls.length);

    for (let i = currentIndex; i < endIndex; i++) {
        const url = allImageUrls[i];

        const imgDiv = document.createElement('div');
        imgDiv.classList.add('image-item');

        const glow = document.createElement('div');
        glow.classList.add('image-glow');

        const img = document.createElement('img');
        img.setAttribute('data-src', url);
        img.alt = 'Image';

        imgDiv.appendChild(glow);
        imgDiv.appendChild(img);
        imageElements.push(imgDiv);

        // 轮询：将图片依次添加到不同的列中（1, 2, 3, 4, 1, 2, 3, 4...）
        // 实现真正的“从左到右、从上往下”加载效果，杜绝右侧空白或闪屏
        columns[i % colNum].appendChild(imgDiv);

        // 为每个图片绑定懒加载观察器
        lazyLoadImage(img);

        // 为每个图片绑定 Lightbox 点击事件
        attachLightboxListener(img);

        // 为每个图片绑定鼠标光效
        attachImageGlowEffect(imgDiv, glow);
    }

    currentIndex = endIndex;
}

// 设置无限滚动（滚动到底部时触发 loadMoreImages）
function setupInfiniteScroll() {
    const sentinel = document.createElement('div');
    sentinel.id = 'sentinel';
    document.body.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            loadMoreImages();
        }
    }, {
        rootMargin: '1500px' // 提前1500px触发加载下一批DOM，增加极大的提前量
    });

    observer.observe(sentinel);
}

// 懒加载功能（仅当图片接近视口时才请求真实的图片资源）
function lazyLoadImage(img) {
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const targetImg = entry.target;
                targetImg.src = targetImg.getAttribute('data-src'); // 替换成真实图片链接

                // 图片加载完成后加上渐显效果
                targetImg.onload = () => {
                    targetImg.style.opacity = 1;
                };

                observer.unobserve(targetImg); // 图片加载完毕后停止观察
            }
        });
    }, {
        rootMargin: '1000px', // 提前1000px开始加载真实图片资源，确保进入视口前已经加载完毕
        threshold: 0.1
    });

    observer.observe(img);
}

// 调用函数来获取并显示图片
fetchImages();

// ========== Lightbox 功能 ==========

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxOverlay = document.querySelector('.lightbox-overlay');
const copyLinkBtn = document.getElementById('copy-link-btn');
const downloadBtn = document.getElementById('download-btn');

let currentImageUrl = ''; // 存储当前查看的图片URL

// 为所有图片添加点击事件，打开 Lightbox
function attachLightboxListener(img) {
    img.addEventListener('click', function () {
        const imageUrl = this.getAttribute('data-src') || this.src;
        openLightbox(imageUrl);
    });

    // 添加鼠标指针变化
    img.style.cursor = 'pointer';
}

// 为图片卡片绑定鼠标跟随光效
function attachImageGlowEffect(card, glow) {
    if (!card || !glow) return;

    card.addEventListener('mousemove', function (event) {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        glow.style.left = `${x}px`;
        glow.style.top = `${y}px`;
    });

    card.addEventListener('mouseleave', function () {
        glow.style.left = '50%';
        glow.style.top = '50%';
    });
}

// 统一处理复制图片链接
function copyImageUrl(imageUrl, button) {
    if (!imageUrl) return;

    copyTextToClipboard(imageUrl).then(() => {
        if (button) {
            showButtonFeedback(button, '✓ 已复制！');
        }
    }).catch(() => {
        alert('复制失败，请重试');
    });
}

// 统一处理下载图片
function downloadImage(imageUrl) {
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `image-${Date.now()}.jpg`;
    link.target = '_blank';
    link.rel = 'noopener';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 统一处理按钮反馈文案
function showButtonFeedback(button, feedbackText) {
    const originalText = button.getAttribute('data-original-text') || button.textContent;
    button.setAttribute('data-original-text', originalText);
    button.textContent = feedbackText;
    button.disabled = true;

    setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
    }, 2000);
}

// 复制文本，优先使用现代 API，失败时回退到传统方案
function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            const copied = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (copied) {
                resolve();
            } else {
                reject();
            }
        } catch (error) {
            document.body.removeChild(textarea);
            reject(error);
        }
    });
}

// 打开 Lightbox
function openLightbox(imageUrl) {
    currentImageUrl = imageUrl;
    lightboxImage.src = imageUrl;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // 禁止背景滚动
}

// 关闭 Lightbox
function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = 'auto'; // 恢复背景滚动
}

// 点击遮罩层关闭 Lightbox
lightboxOverlay.addEventListener('click', closeLightbox);

// 按 ESC 键关闭 Lightbox
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeLightbox();
    }
});

// 复制链接功能
copyLinkBtn.addEventListener('click', function () {
    copyImageUrl(currentImageUrl, copyLinkBtn);
});

// 下载原图功能
downloadBtn.addEventListener('click', function () {
    downloadImage(currentImageUrl);
});
