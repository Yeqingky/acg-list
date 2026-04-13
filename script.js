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

        const img = document.createElement('img');
        img.setAttribute('data-src', url);
        img.alt = 'Image';

        imgDiv.appendChild(img);

        imageElements.push(imgDiv);

        // 轮询：将图片依次添加到不同的列中（1, 2, 3, 4, 1, 2, 3, 4...）
        // 实现真正的“从左到右、从上往下”加载效果，杜绝右侧空白或闪屏
        columns[i % colNum].appendChild(imgDiv);

        // 为每个图片绑定懒加载观察器
        lazyLoadImage(img);

        // 为每个图片绑定 Lightbox 点击事件
        attachLightboxListener(img);
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
    if (!currentImageUrl) return;

    navigator.clipboard.writeText(currentImageUrl).then(() => {
        // 显示反馈
        const originalText = copyLinkBtn.textContent;
        copyLinkBtn.textContent = '✓ 已复制！';
        copyLinkBtn.style.pointerEvents = 'none';

        setTimeout(() => {
            copyLinkBtn.textContent = originalText;
            copyLinkBtn.style.pointerEvents = 'auto';
        }, 2000);
    }).catch(() => {
        alert('复制失败，请重试');
    });
});

// 下载原图功能
downloadBtn.addEventListener('click', function () {
    if (!currentImageUrl) return;

    // 创建一个临时的 a 标签用于下载
    const link = document.createElement('a');
    link.href = currentImageUrl;
    link.download = `image-${Date.now()}.jpg`; // 使用时间戳作为文件名

    // 处理跨域问题：如果直接下载失败，则在新标签页打开
    link.addEventListener('error', () => {
        window.open(currentImageUrl, '_blank');
    });

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
