FROM python:3.12

ENV PYTHONUNBUFFERED=1

RUN groupadd -r python && useradd --no-log-init -r -g python python

COPY --chown=python:python hexagon /tmp/hexagon

RUN set -ex; \
    apt-get update; \
    apt-get install -y libproj-dev libnetcdf-dev cmake build-essential libzstd-dev libpng-dev sqlite3;  \
    mkdir -p /home/python/install/; \
    cd /home/python/install/; \
    wget https://github.com/OSGeo/gdal/releases/download/v3.10.2/gdal-3.10.2.tar.gz -O - | tar -xvzf -; \
    cd gdal-3.10.2; \
    mkdir build; \
    cd build; \
    ECW_ROOT="/tmp/hexagon/ERDAS-ECW_JPEG_2000_SDK-5.5.0/Desktop_Read-Only/"; \
    export ECW_ROOT; \
    cmake .. -DCMAKE_BUILD_TYPE=Release .; \
    cmake --build .; \
    cmake --build . --target install; \
    cp libgdal* /usr/lib

RUN chown python:python -R /home/python

USER python

WORKDIR /home/python

COPY --chown=python:python requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

ENV PATH="/home/python/.local/bin:${PATH}"

COPY --chown=python:python . ./

ENTRYPOINT ["python3", "createShapeBounds.py"]